import { validateRecordedTime } from "@foundry/core";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOwned, requireOwned, requireUserId } from "./lib/auth";
import { appError, checked } from "./lib/errors";
import { legacyDiscardUnfinished } from "./lib/legacyClients";
import { recalcStrengthReferences } from "./lib/strengthReferences";
import {
	ensureSessionExercise,
	getActiveSession,
	planSessionExercise,
	startSession,
} from "./lib/strengthSession";
import { exerciseReference, loadUnit, plannedSet } from "./lib/validators";

export const getActive = query({
	args: {},
	handler: async (ctx) => getActiveSession(ctx, await requireUserId(ctx)),
});

export const listRecent = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit = 5 }) => {
		const userId = await requireUserId(ctx);
		return ctx.db
			.query("workoutSessions")
			.withIndex("by_user_date", (q) => q.eq("userId", userId))
			.order("desc")
			.take(Math.min(limit, 50));
	},
});

export const getById = query({
	args: { id: v.id("workoutSessions") },
	handler: async (ctx, { id }) => getOwned(ctx, await requireUserId(ctx), id),
});

export const create = mutation({
	args: {
		name: v.optional(v.string()),
		/** For a session logged afterwards; defaults to now. */
		startTime: v.optional(v.number()),
	},
	handler: async (ctx, { name, startTime }) =>
		startSession(ctx, await requireUserId(ctx), {
			name,
			startTime,
			prescriptions: [],
		}),
});

export const addExercise = mutation({
	args: { sessionId: v.id("workoutSessions"), exerciseId: exerciseReference },
	handler: async (ctx, { sessionId, exerciseId }) =>
		ensureSessionExercise(ctx, await requireUserId(ctx), sessionId, exerciseId),
});

/**
 * Replaces the Planned Sets of one exercise in an active session; each target
 * is a load or a percentage of the session's 1RM for that exercise.
 */
export const planExercise = mutation({
	args: {
		sessionId: v.id("workoutSessions"),
		exerciseId: exerciseReference,
		unit: loadUnit,
		plannedSets: v.array(
			v.object({
				reps: v.number(),
				weight: v.optional(v.number()),
				percentOfOneRepMax: v.optional(v.number()),
			}),
		),
	},
	returns: v.object({
		exerciseId: exerciseReference,
		plannedSets: v.array(plannedSet),
		oneRepMax: v.union(
			v.null(),
			v.object({
				value: v.number(),
				unit: loadUnit,
				kind: v.union(v.literal("manual"), v.literal("measured")),
			}),
		),
	}),
	handler: async (ctx, { sessionId, exerciseId, unit, plannedSets }) =>
		planSessionExercise(
			ctx,
			await requireUserId(ctx),
			sessionId,
			exerciseId,
			unit,
			plannedSets,
		),
});

export const finish = mutation({
	args: {
		id: v.id("workoutSessions"),
		discardUnfinished: legacyDiscardUnfinished,
		/** For a session logged afterwards; defaults to now. */
		endTime: v.optional(v.number()),
	},
	handler: async (ctx, { id, endTime }) => {
		const session = await requireOwned(ctx, await requireUserId(ctx), id);
		if (session.status === "completed") return;
		if (session.status !== "active") throw appError("sessionEnded");
		const set = await ctx.db
			.query("sets")
			.withIndex("by_session", (q) => q.eq("sessionId", id))
			.first();
		const wod = await ctx.db
			.query("wodResults")
			.withIndex("by_session", (q) => q.eq("sessionId", id))
			.first();
		if (!set && !wod) throw appError("emptySession");
		const now = Date.now();
		await ctx.db.patch(id, {
			status: "completed",
			endTime:
				endTime === undefined
					? now
					: checked(
							validateRecordedTime("endTime", endTime, now, session.startTime),
						),
		});
	},
});

export const cancel = mutation({
	args: { id: v.id("workoutSessions") },
	handler: async (ctx, { id }) => {
		const session = await requireOwned(ctx, await requireUserId(ctx), id);
		if (session.status === "cancelled") return;
		if (session.status !== "active") throw appError("sessionEnded");
		await ctx.db.patch(id, { status: "cancelled", endTime: Date.now() });
	},
});

export const remove = mutation({
	args: { id: v.id("workoutSessions") },
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		await requireOwned(ctx, userId, id);
		const wodResults = await ctx.db
			.query("wodResults")
			.withIndex("by_session", (q) => q.eq("sessionId", id))
			.collect();
		for (const result of wodResults) await ctx.db.delete(result._id);
		const sets = await ctx.db
			.query("sets")
			.withIndex("by_session", (q) => q.eq("sessionId", id))
			.collect();
		for (const set of sets) await ctx.db.delete(set._id);
		for (const exerciseId of new Set(sets.map((set) => set.exerciseId)))
			await recalcStrengthReferences(ctx, userId, exerciseId);
		await ctx.db.delete(id);
	},
});
