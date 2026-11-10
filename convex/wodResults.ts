import { bestScore } from "@foundry/core";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned, requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";
import { wodScoreFields } from "./lib/validators";
import { checkedWodScore } from "./lib/wods";

export const log = mutation({
	args: {
		wodId: v.id("wods"),
		sessionId: v.optional(v.id("workoutSessions")),
		date: v.optional(v.number()),
		rxScaled: v.union(v.literal("rx"), v.literal("scaled")),
		...wodScoreFields,
	},
	handler: async (ctx, { wodId, sessionId, date, rxScaled, ...input }) => {
		const userId = await requireUserId(ctx);
		const wod = await ctx.db.get(wodId);
		if (!wod || (!wod.isDefault && wod.userId !== userId))
			throw appError("notFound", "wodId");
		const score = checkedWodScore(wod.type, input);
		if (sessionId) await requireOwned(ctx, userId, sessionId);
		return ctx.db.insert("wodResults", {
			userId,
			wodId,
			sessionId,
			date: date ?? Date.now(),
			rxScaled,
			...score,
		});
	},
});

export const listForWod = query({
	args: { wodId: v.id("wods") },
	handler: async (ctx, { wodId }) => {
		const userId = await requireUserId(ctx);
		const results = await ctx.db
			.query("wodResults")
			.withIndex("by_user_wod", (q) =>
				q.eq("userId", userId).eq("wodId", wodId),
			)
			.collect();
		return results.sort((a, b) => a.date - b.date);
	},
});

export const listForSession = query({
	args: { sessionId: v.id("workoutSessions") },
	handler: async (ctx, { sessionId }) => {
		const userId = await requireUserId(ctx);
		const results = await ctx.db
			.query("wodResults")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.collect();
		return results.filter((result) => result.userId === userId);
	},
});

export const getBest = query({
	args: { wodId: v.id("wods") },
	handler: async (ctx, { wodId }) => {
		const userId = await requireUserId(ctx);
		const wod = await ctx.db.get(wodId);
		if (!wod) return null;
		const results = await ctx.db
			.query("wodResults")
			.withIndex("by_user_wod", (q) =>
				q.eq("userId", userId).eq("wodId", wodId),
			)
			.collect();
		return bestScore(wod.type, results);
	},
});

export const remove = mutation({
	args: { id: v.id("wodResults") },
	handler: async (ctx, { id }) => {
		await requireOwned(ctx, await requireUserId(ctx), id);
		await ctx.db.delete(id);
	},
});
