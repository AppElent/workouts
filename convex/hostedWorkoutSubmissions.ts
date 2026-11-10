import { validateWodScore } from "@foundry/core";
import { type ObjectType, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { appError, checked } from "./lib/errors";
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

/** One submission per guest name per WOD block; a re-submit updates it. */
export const submitGuest = mutation({
	args: {
		token: v.string(),
		guestName: v.string(),
		wodBlockId: v.string(),
		...scoreFields,
	},
	handler: async (ctx, { token, guestName, wodBlockId, ...score }) => {
		const name = guestName.trim();
		if (name.length < 2) throw appError("invalid", "guestName");
		if (name.length > 80) throw appError("tooLong", "guestName");
		const hosted = await ctx.db
			.query("hostedWorkouts")
			.withIndex("by_join_token", (q) => q.eq("joinToken", token))
			.first();
		if (!hosted) throw appError("notFound");
		scoredLevel(hosted, wodBlockId, score);
		const existing = (await blockSubmissions(ctx, hosted, wodBlockId)).find(
			(row) => row.guestName === name,
		);
		if (existing) {
			await ctx.db.patch(existing._id, submissionFields(score));
			return existing._id;
		}
		return ctx.db.insert("hostedWorkoutSubmissions", {
			hostedWorkoutId: hosted._id,
			guestName: name,
			wodBlockId,
			...submissionFields(score),
		});
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
