import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOwned, requireOwned, requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";
import { recalcStrengthReferences } from "./lib/strengthReferences";
import {
	ensureSessionExercise,
	getActiveSession,
	startSession,
} from "./lib/strengthSession";
import { exerciseReference } from "./lib/validators";

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
	args: { name: v.optional(v.string()) },
	handler: async (ctx, { name }) =>
		startSession(ctx, await requireUserId(ctx), { name, prescriptions: [] }),
});

export const addExercise = mutation({
	args: { sessionId: v.id("workoutSessions"), exerciseId: exerciseReference },
	handler: async (ctx, { sessionId, exerciseId }) =>
		ensureSessionExercise(ctx, await requireUserId(ctx), sessionId, exerciseId),
});

export const finish = mutation({
	args: { id: v.id("workoutSessions") },
	handler: async (ctx, { id }) => {
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
		await ctx.db.patch(id, { status: "completed", endTime: Date.now() });
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
