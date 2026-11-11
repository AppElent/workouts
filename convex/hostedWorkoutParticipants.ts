import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";
import { joinHosted, toHostedSessionDto } from "./lib/hosted";

export const join = mutation({
	args: { token: v.string(), displayName: v.optional(v.string()) },
	handler: async (ctx, { token, displayName }) => {
		const userId = await requireUserId(ctx);
		const hosted = await ctx.db
			.query("hostedWorkouts")
			.withIndex("by_join_token", (q) => q.eq("joinToken", token))
			.first();
		if (!hosted) throw appError("notFound");
		if (hosted.status !== "open")
			throw appError(
				hosted.status === "closed" ? "hostedClosed" : "hostedNotOpen",
			);
		const existing = await ctx.db
			.query("hostedWorkoutParticipants")
			.withIndex("by_hosted_workout_user", (q) =>
				q.eq("hostedWorkoutId", hosted._id).eq("userId", userId),
			)
			.first();
		if (existing) return existing.sessionId;
		return joinHosted(ctx, hosted, userId, displayName?.trim() || undefined);
	},
});

export const getMyParticipant = query({
	args: { hostedWorkoutId: v.id("hostedWorkouts") },
	handler: async (ctx, { hostedWorkoutId }) => {
		const userId = await requireUserId(ctx);
		return ctx.db
			.query("hostedWorkoutParticipants")
			.withIndex("by_hosted_workout_user", (q) =>
				q.eq("hostedWorkoutId", hostedWorkoutId).eq("userId", userId),
			)
			.first();
	},
});

export const getBySession = query({
	args: { sessionId: v.id("workoutSessions") },
	handler: async (ctx, { sessionId }) => {
		const userId = await requireUserId(ctx);
		const participant = await ctx.db
			.query("hostedWorkoutParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.first();
		if (!participant || participant.userId !== userId) return null;
		const hosted = await ctx.db.get(participant.hostedWorkoutId);
		return hosted ? { hosted: toHostedSessionDto(hosted) } : null;
	},
});
