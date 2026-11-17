import { validateWodScore } from "@foundry/core";
import { type ObjectType, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { appError, checked } from "./lib/errors";
import { joinHosted } from "./lib/hosted";
import { hostedLevel, wodScoreFields } from "./lib/validators";
import { recordWodResult, wodDefinitionOf } from "./lib/wods";

const scoreFields = { level: hostedLevel, ...wodScoreFields };

type Score = ObjectType<typeof scoreFields>;

/** The WOD block and level a score is for, on a workout open for scoring. */
function scoredLevel(
	hosted: Doc<"hostedWorkouts">,
	wodBlockId: string,
	score: Score,
) {
	if (hosted.status === "closed") throw appError("hostedClosed");
	if (hosted.status !== "open") throw appError("hostedNotOpen");
	const block = hosted.template.wodBlocks.find(
		(item) => item.blockId === wodBlockId,
	);
	if (!block) throw appError("notFound", "wodBlockId");
	const level = block.levels.find((item) => item.level === score.level);
	if (!level) throw appError("notFound", "level");
	checked(validateWodScore(block.type, score));
	return { block, level };
}

function submissionFields(score: Score) {
	return {
		level: score.level,
		timeSeconds: score.timeSeconds,
		rounds: score.rounds,
		reps: score.reps,
		timeCapped: score.timeCapped,
		load: score.load,
		loadUnit: score.loadUnit,
		notes: score.notes,
		submittedAt: Date.now(),
	};
}

function blockSubmissions(
	ctx: MutationCtx,
	hosted: Doc<"hostedWorkouts">,
	wodBlockId: string,
) {
	return ctx.db
		.query("hostedWorkoutSubmissions")
		.withIndex("by_hosted_workout_wod", (q) =>
			q.eq("hostedWorkoutId", hosted._id).eq("wodBlockId", wodBlockId),
		)
		.collect();
}

/**
 * One submission per participant per WOD block: a re-submit updates the
 * leaderboard row and the athlete's own WOD and result.
 */
export const submitForSession = mutation({
	args: {
		sessionId: v.id("workoutSessions"),
		wodBlockId: v.string(),
		...scoreFields,
	},
	handler: async (ctx, { sessionId, wodBlockId, ...score }) => {
		const userId = await requireUserId(ctx);
		const participant = await ctx.db
			.query("hostedWorkoutParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.first();
		if (!participant || participant.userId !== userId)
			throw appError("notFound", "sessionId");
		const hosted = await ctx.db.get(participant.hostedWorkoutId);
		if (!hosted) throw appError("notFound");
		const { block, level } = scoredLevel(hosted, wodBlockId, score);
		const existing = (await blockSubmissions(ctx, hosted, wodBlockId)).find(
			(row) => row.participantId === participant._id,
		);
		const recorded = await recordWodResult(ctx, userId, {
			wod: { ...wodDefinitionOf(block), movements: level.movements },
			sessionId,
			rxScaled: score.level === "rx" ? "rx" : "scaled",
			score,
			previous: existing,
		});
		const fields = { ...submissionFields(score), ...recorded };
		if (existing) {
			await ctx.db.patch(existing._id, fields);
			return existing._id;
		}
		return ctx.db.insert("hostedWorkoutSubmissions", {
			hostedWorkoutId: hosted._id,
			participantId: participant._id,
			wodBlockId,
			...fields,
		});
	},
});

const GUEST_KEY = /^[A-Za-z0-9_-]{16,64}$/;

function checkedGuestKey(guestKey: string) {
	if (!GUEST_KEY.test(guestKey)) throw appError("invalid", "guestKey");
	return guestKey;
}

async function hostedByToken(ctx: QueryCtx, token: string) {
	const hosted = await ctx.db
		.query("hostedWorkouts")
		.withIndex("by_join_token", (q) => q.eq("joinToken", token))
		.first();
	if (!hosted) throw appError("notFound");
	return hosted;
}

function checkedGuestName(guestName: string) {
	const name = guestName.trim();
	if (name.length < 2) throw appError("invalid", "guestName");
	if (name.length > 80) throw appError("tooLong", "guestName");
	return name;
}

/** The guest submissions sent from one browser, not yet claimed. */
async function guestSubmissions(
	ctx: QueryCtx,
	hosted: Doc<"hostedWorkouts">,
	guestKey: string,
) {
	const rows = await ctx.db
		.query("hostedWorkoutSubmissions")
		.withIndex("by_hosted_workout", (q) => q.eq("hostedWorkoutId", hosted._id))
		.collect();
	return rows.filter((row) => !row.participantId && row.guestKey === guestKey);
}

/**
 * One submission per guest per WOD block, keyed by the browser's guest key
 * and the typed name together: two guests called Sam on their own phones keep
 * separate rows, so do Alex and Sam taking turns on one shared device, and a
 * re-submit with the same name from the same browser corrects that score.
 */
export const submitGuest = mutation({
	args: {
		token: v.string(),
		guestName: v.string(),
		// Optional only for web clients loaded before the key shipped: without
		// one, every submit adds a new row and nothing is ever overwritten.
		guestKey: v.optional(v.string()),
		wodBlockId: v.string(),
		...scoreFields,
	},
	handler: async (
		ctx,
		{ token, guestName, guestKey, wodBlockId, ...score },
	) => {
		const name = checkedGuestName(guestName);
		const key = guestKey === undefined ? undefined : checkedGuestKey(guestKey);
		const hosted = await hostedByToken(ctx, token);
		scoredLevel(hosted, wodBlockId, score);
		const existing =
			key === undefined
				? undefined
				: (await blockSubmissions(ctx, hosted, wodBlockId)).find(
						(row) =>
							!row.participantId &&
							row.guestKey === key &&
							row.guestName === name,
					);
		if (existing) {
			await ctx.db.patch(existing._id, submissionFields(score));
			return existing._id;
		}
		return ctx.db.insert("hostedWorkoutSubmissions", {
			hostedWorkoutId: hosted._id,
			guestName: name,
			guestKey: key,
			wodBlockId,
			...submissionFields(score),
		});
	},
});

/**
 * Public: the guest names this browser scored under on the workout, with how
 * many unclaimed scores each has, so the join page can offer to claim them
 * after sign-up. More than one name means a shared device; each person claims
 * only their own name.
 */
export const listGuestScores = query({
	args: { token: v.string(), guestKey: v.string() },
	handler: async (ctx, { token, guestKey }) => {
		if (!GUEST_KEY.test(guestKey)) return [];
		const hosted = await ctx.db
			.query("hostedWorkouts")
			.withIndex("by_join_token", (q) => q.eq("joinToken", token))
			.first();
		if (!hosted || hosted.status === "draft") return [];
		const counts = new Map<string, number>();
		for (const row of await guestSubmissions(ctx, hosted, guestKey))
			if (row.guestName)
				counts.set(row.guestName, (counts.get(row.guestName) ?? 0) + 1);
		return [...counts].map(([guestName, count]) => ({ guestName, count }));
	},
});

/**
 * Turns this browser's guest scores under one name into the signed-in
 * athlete's own Submissions (ADR 0008): joins them to the workout if needed,
 * records each score as a WOD Result in their history, and links the
 * leaderboard row. A WOD block the athlete already scored while signed in
 * keeps that score; the guest row stays on the leaderboard as a plain guest
 * score that can no longer be claimed or corrected.
 */
export const claimGuestSubmissions = mutation({
	args: { token: v.string(), guestKey: v.string(), guestName: v.string() },
	handler: async (ctx, { token, guestKey, guestName }) => {
		const userId = await requireUserId(ctx);
		const key = checkedGuestKey(guestKey);
		const name = checkedGuestName(guestName);
		const hosted = await hostedByToken(ctx, token);
		if (hosted.status === "draft") throw appError("hostedNotOpen");
		const rows = (await guestSubmissions(ctx, hosted, key)).filter(
			(row) => row.guestName === name,
		);
		if (rows.length === 0) throw appError("notFound", "guestName");
		let participant = await ctx.db
			.query("hostedWorkoutParticipants")
			.withIndex("by_hosted_workout_user", (q) =>
				q.eq("hostedWorkoutId", hosted._id).eq("userId", userId),
			)
			.first();
		if (!participant) {
			const sessionId = await joinHosted(ctx, hosted, userId, name);
			// The session is for the workout the guest already did, so it is
			// dated at their first score rather than at the claim.
			const submitted = rows.map((row) => row.submittedAt);
			const startTime = Math.min(...submitted);
			await ctx.db.patch(sessionId, {
				date: hosted.scheduledAt ?? startTime,
				startTime,
				...(hosted.status === "closed"
					? { status: "completed" as const, endTime: Math.max(...submitted) }
					: {}),
			});
			participant = await ctx.db
				.query("hostedWorkoutParticipants")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
				.first();
			if (!participant) throw appError("notFound");
		}
		const participantId = participant._id;
		let claimed = 0;
		let skipped = 0;
		for (const row of rows) {
			const alreadyScored = (
				await blockSubmissions(ctx, hosted, row.wodBlockId)
			).some((other) => other.participantId === participantId);
			const block = hosted.template.wodBlocks.find(
				(item) => item.blockId === row.wodBlockId,
			);
			const level = block?.levels.find((item) => item.level === row.level);
			if (alreadyScored || !block || !level) {
				await ctx.db.patch(row._id, { guestKey: undefined });
				skipped += 1;
				continue;
			}
			const recorded = await recordWodResult(ctx, userId, {
				wod: { ...wodDefinitionOf(block), movements: level.movements },
				sessionId: participant.sessionId,
				rxScaled: row.level === "rx" ? "rx" : "scaled",
				score: row,
				date: row.submittedAt,
			});
			await ctx.db.patch(row._id, {
				participantId,
				guestName: undefined,
				guestKey: undefined,
				...recorded,
			});
			claimed += 1;
		}
		return { sessionId: participant.sessionId, claimed, skipped };
	},
});

/**
 * Removes a score from the host's leaderboard. The athlete's own WOD and
 * result stay in their library.
 */
export const remove = mutation({
	args: { id: v.id("hostedWorkoutSubmissions") },
	handler: async (ctx, { id }) => {
		const hostUserId = await requireUserId(ctx);
		const submission = await ctx.db.get(id);
		const hosted = submission && (await ctx.db.get(submission.hostedWorkoutId));
		if (!hosted || hosted.hostUserId !== hostUserId) throw appError("notFound");
		await ctx.db.delete(id);
	},
});
