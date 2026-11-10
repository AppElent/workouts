import { HOSTED_LEVELS } from "@foundry/core";
import { type ObjectType, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
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
		return { hosted, participants, submissions };
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
 * Ends every participant session still active when the workout ends, so no
 * one is left locked out of starting another session.
 */
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
	for (const participant of participants) {
		const session = await ctx.db.get(participant.sessionId);
		if (session?.status !== "active") continue;
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
	}
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
