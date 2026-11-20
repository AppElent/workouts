import { HOSTED_LEVELS } from "@foundry/core";
import { type ObjectType, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";
import { requireExercise } from "./lib/exerciseCatalog";
import { joinHosted, toPublicHostedTemplate } from "./lib/hosted";
import {
	hostedPrescriptions,
	validatePrescriptions,
} from "./lib/strengthSession";
import schema from "./schema";

const stored = schema.tables.hostedWorkouts.validator.fields;
const draftFields = {
	title: stored.title,
	notes: stored.notes,
	scheduledAt: stored.scheduledAt,
	hostParticipation: stored.hostParticipation,
	template: stored.template,
};

type Draft = ObjectType<typeof draftFields>;

const JOIN_TOKEN_ALPHABET =
	"abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function createJoinToken(ctx: MutationCtx) {
	for (let attempt = 0; attempt < 5; attempt++) {
		const values = crypto.getRandomValues(new Uint32Array(18));
		const token = Array.from(
			values,
			(value) => JOIN_TOKEN_ALPHABET[value % JOIN_TOKEN_ALPHABET.length],
		).join("");
		const existing = await ctx.db
			.query("hostedWorkouts")
			.withIndex("by_join_token", (q) => q.eq("joinToken", token))
			.first();
		if (!existing) return token;
	}
	throw appError("failed", "joinToken");
}

/** A draft as stored: trimmed text, canonical exercise ids, usable blocks. */
async function checkedDraft(
	ctx: MutationCtx,
	hostUserId: string,
	draft: Draft,
) {
	const title = draft.title.trim();
	if (!title) throw appError("invalid", "title");
	const { strengthBlocks, wodBlocks } = draft.template;
	if (strengthBlocks.length === 0 && wodBlocks.length === 0)
		throw appError("templateEmpty");
	for (const block of strengthBlocks)
		if (!block.exerciseName.trim()) throw appError("invalid", "exerciseName");
	for (const block of wodBlocks) {
		if (!block.name.trim()) throw appError("invalid", "name");
		const levels = new Set(block.levels.map((item) => item.level));
		if (HOSTED_LEVELS.some((level) => !levels.has(level)))
			throw appError("levelsIncomplete");
	}
	validatePrescriptions(hostedPrescriptions(strengthBlocks));
	return {
		...draft,
		title,
		notes: draft.notes?.trim() || undefined,
		template: {
			wodBlocks,
			strengthBlocks: await Promise.all(
				strengthBlocks.map(async (block) =>
					block.exerciseId
						? {
								...block,
								exerciseId: await requireExercise(
									ctx,
									block.exerciseId,
									hostUserId,
								),
							}
						: block,
				),
			),
		},
	};
}

async function requireHosted(ctx: MutationCtx, id: Id<"hostedWorkouts">) {
	const hostUserId = await requireUserId(ctx);
	const hosted = await ctx.db.get(id);
	if (!hosted || hosted.hostUserId !== hostUserId) throw appError("notFound");
	return hosted;
}

export const createDraft = mutation({
	args: draftFields,
	handler: async (ctx, draft) => {
		const hostUserId = await requireUserId(ctx);
		return ctx.db.insert("hostedWorkouts", {
			...(await checkedDraft(ctx, hostUserId, draft)),
			hostUserId,
			status: "draft",
			joinToken: await createJoinToken(ctx),
			createdAt: Date.now(),
		});
	},
});

export const listMine = query({
	args: {},
	handler: async (ctx) => {
		const hostUserId = await requireUserId(ctx);
		return ctx.db
			.query("hostedWorkouts")
			.withIndex("by_host", (q) => q.eq("hostUserId", hostUserId))
			.order("desc")
			.collect();
	},
});

export const getMine = query({
	args: { id: v.id("hostedWorkouts") },
	handler: async (ctx, { id }) => {
		const hostUserId = await requireUserId(ctx);
		const hosted = await ctx.db.get(id);
		if (!hosted || hosted.hostUserId !== hostUserId) return null;
		const participants = await ctx.db
			.query("hostedWorkoutParticipants")
			.withIndex("by_hosted_workout", (q) => q.eq("hostedWorkoutId", id))
			.collect();
		const submissions = await ctx.db
			.query("hostedWorkoutSubmissions")
			.withIndex("by_hosted_workout", (q) => q.eq("hostedWorkoutId", id))
			.collect();
		return {
			hosted,
			participants,
			// The guest key lets its holder correct or claim that score.
			submissions: submissions.map(({ guestKey: _guestKey, ...row }) => row),
		};
	},
});

/** Public: anyone with the join link sees an opened workout's leaderboard. */
export const getByJoinToken = query({
	args: { token: v.string() },
	handler: async (ctx, { token }) => {
		const hosted = await ctx.db
			.query("hostedWorkouts")
			.withIndex("by_join_token", (q) => q.eq("joinToken", token))
			.first();
		if (!hosted || hosted.status === "draft") return null;
		const submissions = await ctx.db
			.query("hostedWorkoutSubmissions")
			.withIndex("by_hosted_workout", (q) =>
				q.eq("hostedWorkoutId", hosted._id),
			)
			.collect();
		const publicSubmissions = await Promise.all(
			submissions.map(async (submission) => {
				const participant = submission.participantId
					? await ctx.db.get(submission.participantId)
					: null;
				return {
					/** `null` when the athlete gave no name; clients label them. */
					athleteName: submission.guestName ?? participant?.displayName ?? null,
					byHost: participant?.userId === hosted.hostUserId,
					guestName: submission.guestName,
					wodBlockId: submission.wodBlockId,
					level: submission.level,
					timeSeconds: submission.timeSeconds,
					rounds: submission.rounds,
					reps: submission.reps,
					timeCapped: submission.timeCapped,
					load: submission.load,
					loadUnit: submission.loadUnit,
					notes: submission.notes,
					submittedAt: submission.submittedAt,
				};
			}),
		);
		return {
			hosted: {
				title: hosted.title,
				notes: hosted.notes,
				scheduledAt: hosted.scheduledAt,
				status: hosted.status,
				template: toPublicHostedTemplate(hosted.template),
			},
			submissions: publicSubmissions,
		};
	},
});

export const updateDraft = mutation({
	args: { id: v.id("hostedWorkouts"), ...draftFields },
	handler: async (ctx, { id, ...draft }) => {
		const hosted = await requireHosted(ctx, id);
		if (hosted.status !== "draft") throw appError("hostedNotDraft");
		await ctx.db.patch(id, await checkedDraft(ctx, hosted.hostUserId, draft));
	},
});

export const open = mutation({
	args: { id: v.id("hostedWorkouts") },
	handler: async (ctx, { id }) => {
		const hosted = await requireHosted(ctx, id);
		if (hosted.status !== "draft") throw appError("hostedNotDraft");
		await ctx.db.patch(id, { status: "open", openedAt: Date.now() });
		if (hosted.hostParticipation === "hostAndParticipate") {
			const existing = await ctx.db
				.query("hostedWorkoutParticipants")
				.withIndex("by_hosted_workout_user", (q) =>
					q.eq("hostedWorkoutId", id).eq("userId", hosted.hostUserId),
				)
				.first();
			if (!existing)
				await joinHosted(ctx, hosted, hosted.hostUserId, undefined);
		}
	},
});

/**
 * Ends the participant's session if it is still active: completed when they
 * logged a set or WOD result, cancelled otherwise, so no one is left locked
 * out of starting another session.
 */
async function finishParticipantSession(
	ctx: MutationCtx,
	participant: Doc<"hostedWorkoutParticipants">,
	now: number,
) {
	const session = await ctx.db.get(participant.sessionId);
	if (session?.status !== "active") return false;
	const [set, wod] = await Promise.all([
		ctx.db
			.query("sets")
			.withIndex("by_session", (q) => q.eq("sessionId", session._id))
			.first(),
		ctx.db
			.query("wodResults")
			.withIndex("by_session", (q) => q.eq("sessionId", session._id))
			.first(),
	]);
	await ctx.db.patch(session._id, {
		status: set || wod ? "completed" : "cancelled",
		endTime: now,
	});
	return true;
}

/** Ends every participant session still active when the workout ends. */
async function finishParticipantSessions(
	ctx: MutationCtx,
	hostedWorkoutId: Id<"hostedWorkouts">,
) {
	const participants = await ctx.db
		.query("hostedWorkoutParticipants")
		.withIndex("by_hosted_workout", (q) =>
			q.eq("hostedWorkoutId", hostedWorkoutId),
		)
		.collect();
	const now = Date.now();
	for (const participant of participants)
		await finishParticipantSession(ctx, participant, now);
}

export const close = mutation({
	args: { id: v.id("hostedWorkouts") },
	handler: async (ctx, { id }) => {
		const hosted = await requireHosted(ctx, id);
		if (hosted.status !== "open") throw appError("hostedNotOpen");
		await ctx.db.patch(id, { status: "closed", closedAt: Date.now() });
		await finishParticipantSessions(ctx, id);
	},
});

export const remove = mutation({
	args: { id: v.id("hostedWorkouts") },
	handler: async (ctx, { id }) => {
		await requireHosted(ctx, id);
		await finishParticipantSessions(ctx, id);
		for (const table of [
			"hostedWorkoutSubmissions",
			"hostedWorkoutParticipants",
		] as const) {
			const rows = await ctx.db
				.query(table)
				.withIndex("by_hosted_workout", (q) => q.eq("hostedWorkoutId", id))
				.collect();
			for (const row of rows) await ctx.db.delete(row._id);
		}
		await ctx.db.delete(id);
	},
});

/** Rows one `wipeAll` call deletes at most, well inside Convex limits. */
const WIPE_BATCH_SIZE = 200;
/** Rows a dry run counts per table before reporting `atLeast`. */
const WIPE_COUNT_CAP = 1000;

const wipeCounts = v.object({
	hostedWorkouts: v.number(),
	hostedWorkoutParticipants: v.number(),
	hostedWorkoutSubmissions: v.number(),
	runningSessions: v.number(),
});
type WipeCounts = ObjectType<(typeof wipeCounts)["fields"]>;

const NO_WIPE_COUNTS: WipeCounts = {
	hostedWorkouts: 0,
	hostedWorkoutParticipants: 0,
	hostedWorkoutSubmissions: 0,
	runningSessions: 0,
};

/**
 * Wipes every Hosted Workout row (APP-452, ADR 0018). Run by hand from the
 * Convex dashboard or `convex run`; no client calls it.
 *
 * `dryRun: true` only counts: each table up to `WIPE_COUNT_CAP` rows, with
 * `atLeast` set when a table holds more. `runningSessions` counts the
 * participant sessions a wipe would end.
 *
 * `dryRun: false` deletes up to `batchSize` rows per call, Submissions first,
 * then Participants (ending each one's running session the way deleting a
 * workout does), then the workouts, and schedules itself until all three
 * tables are empty. Participants keep their own sessions, sets, WODs, and WOD
 * Results. A repeat run finds nothing and stops. Logs counts only.
 */
export const wipeAll = internalMutation({
	args: {
		dryRun: v.boolean(),
		batchSize: v.optional(v.number()),
		/** Running totals carried between scheduled batches. */
		totals: v.optional(wipeCounts),
	},
	returns: v.union(
		v.object({
			dryRun: v.literal(true),
			counts: wipeCounts,
			atLeast: v.boolean(),
		}),
		v.object({
			dryRun: v.literal(false),
			deleted: wipeCounts,
			totals: wipeCounts,
			done: v.boolean(),
		}),
	),
	handler: async (ctx, { dryRun, batchSize = WIPE_BATCH_SIZE, totals }) => {
		if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000)
			throw appError("invalid", "batchSize");
		if (dryRun) {
			const [workouts, participants, submissions] = await Promise.all([
				ctx.db.query("hostedWorkouts").take(WIPE_COUNT_CAP + 1),
				ctx.db.query("hostedWorkoutParticipants").take(WIPE_COUNT_CAP + 1),
				ctx.db.query("hostedWorkoutSubmissions").take(WIPE_COUNT_CAP + 1),
			]);
			let runningSessions = 0;
			for (const participant of participants.slice(0, WIPE_COUNT_CAP))
				if ((await ctx.db.get(participant.sessionId))?.status === "active")
					runningSessions++;
			const counts = {
				hostedWorkouts: Math.min(workouts.length, WIPE_COUNT_CAP),
				hostedWorkoutParticipants: Math.min(
					participants.length,
					WIPE_COUNT_CAP,
				),
				hostedWorkoutSubmissions: Math.min(submissions.length, WIPE_COUNT_CAP),
				runningSessions,
			};
			const atLeast = [workouts, participants, submissions].some(
				(rows) => rows.length > WIPE_COUNT_CAP,
			);
			console.log("hostedWorkouts.wipeAll dry run", { ...counts, atLeast });
			return { dryRun: true as const, counts, atLeast };
		}

		const deleted = { ...NO_WIPE_COUNTS };
		let budget = batchSize;
		const submissions = await ctx.db
			.query("hostedWorkoutSubmissions")
			.take(budget);
		for (const row of submissions) await ctx.db.delete(row._id);
		deleted.hostedWorkoutSubmissions = submissions.length;
		budget -= submissions.length;
		if (budget > 0) {
			const participants = await ctx.db
				.query("hostedWorkoutParticipants")
				.take(budget);
			const now = Date.now();
			for (const participant of participants) {
				if (await finishParticipantSession(ctx, participant, now))
					deleted.runningSessions++;
				await ctx.db.delete(participant._id);
			}
			deleted.hostedWorkoutParticipants = participants.length;
			budget -= participants.length;
		}
		if (budget > 0) {
			const workouts = await ctx.db.query("hostedWorkouts").take(budget);
			for (const row of workouts) await ctx.db.delete(row._id);
			deleted.hostedWorkouts = workouts.length;
			budget -= workouts.length;
		}
		const sum = { ...(totals ?? NO_WIPE_COUNTS) };
		for (const key of Object.keys(sum) as (keyof WipeCounts)[])
			sum[key] += deleted[key];
		// A full batch may have left rows behind; a short one emptied all three.
		const done = budget > 0;
		if (done) console.log("hostedWorkouts.wipeAll done", sum);
		else {
			console.log("hostedWorkouts.wipeAll batch", deleted);
			await ctx.scheduler.runAfter(0, internal.hostedWorkouts.wipeAll, {
				dryRun: false,
				batchSize,
				totals: sum,
			});
		}
		return { dryRun: false as const, deleted, totals: sum, done };
	},
});
