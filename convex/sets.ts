import { validateSetInput } from "@foundry/core";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireOwned, requireUserId } from "./lib/auth";
import { checked } from "./lib/errors";
import { findReceipt, withOperationReceipt } from "./lib/operationReceipt";
import {
	performanceReference,
	recalcStrengthReferences,
} from "./lib/strengthReferences";
import { ensureSessionExercise } from "./lib/strengthSession";
import { exerciseReference, loadUnit, setType } from "./lib/validators";
import schema from "./schema";

export const listForSession = query({
	args: { sessionId: v.id("workoutSessions") },
	handler: async (ctx, { sessionId }) => {
		const userId = await requireUserId(ctx);
		const sets = await ctx.db
			.query("sets")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.collect();
		return sets.filter((s) => s.userId === userId);
	},
});

export const add = mutation({
	args: {
		operationId: v.string(),
		sessionId: v.id("workoutSessions"),
		exerciseId: exerciseReference,
		setNumber: v.number(),
		reps: v.number(),
		weight: v.number(),
		unit: loadUnit,
		rpe: v.optional(v.number()),
		setType,
	},
	handler: async (ctx, { operationId, ...values }) => {
		const userId = await requireUserId(ctx);
		// A coded rejection tells the client this operation did not commit, so it
		// may unlock the input; a transport failure keeps the operation id frozen.
		checked(validateSetInput(values));
		return withOperationReceipt(
			ctx,
			"strengthLogReceipts",
			{ userId, operationId, payload: values },
			async () => {
				const exerciseId = await ensureSessionExercise(
					ctx,
					userId,
					values.sessionId,
					values.exerciseId,
				);
				const set = { ...values, exerciseId, performanceVerified: true };
				const setId = await ctx.db.insert("sets", {
					...set,
					userId,
					loggedAt: Date.now(),
					...(await performanceReference(ctx, userId, set)),
				});
				await recalcStrengthReferences(ctx, userId, exerciseId);
				return setId;
			},
		);
	},
});

export const getLogResult = query({
	args: { operationId: v.string() },
	handler: async (ctx, { operationId }) => {
		const userId = await requireUserId(ctx);
		const receipt = await findReceipt(
			ctx,
			"strengthLogReceipts",
			userId,
			operationId,
		);
		if (!receipt) return null;
		return {
			setId: receipt.setId,
			status: (await ctx.db.get(receipt.setId))
				? ("saved" as const)
				: ("removed" as const),
		};
	},
});

export const update = mutation({
	args: {
		id: v.id("sets"),
		reps: v.optional(v.number()),
		weight: v.optional(v.number()),
		unit: v.optional(loadUnit),
		rpe: v.optional(v.union(v.number(), v.null())),
		setType: v.optional(setType),
	},
	handler: async (ctx, { id, rpe, ...values }) => {
		const userId = await requireUserId(ctx);
		checked(validateSetInput({ ...values, rpe }));
		const patch = {
			...values,
			...(rpe === undefined ? {} : { rpe: rpe ?? undefined }),
		};
		const set = await requireOwned(ctx, userId, id);
		await ctx.db.patch(id, {
			...patch,
			...(await performanceReference(ctx, userId, { ...set, ...patch })),
		});
		await recalcStrengthReferences(ctx, userId, set.exerciseId);
	},
});

export const getLastForExercise = query({
	args: {
		exerciseId: exerciseReference,
		excludeSessionId: v.optional(v.id("workoutSessions")),
	},
	handler: async (ctx, { exerciseId, excludeSessionId }) => {
		const userId = await requireUserId(ctx);
		return latestSetForExercise(ctx, userId, exerciseId, excludeSessionId);
	},
});

/**
 * Sets of the last other session that logged this exercise, by set number.
 * Only builds older than #194 call this; delete it with `lib/legacyClients.ts`.
 */
export const getPreviousForExercise = query({
	args: { exerciseId: exerciseReference, sessionId: v.id("workoutSessions") },
	returns: v.array(
		v.object({
			_id: v.id("sets"),
			_creationTime: v.number(),
			...schema.tables.sets.validator.fields,
		}),
	),
	handler: async (ctx, { exerciseId, sessionId }) => {
		const userId = await requireUserId(ctx);
		const latest = await latestSetForExercise(
			ctx,
			userId,
			exerciseId,
			sessionId,
		);
		if (!latest) return [];
		const sets = await ctx.db
			.query("sets")
			.withIndex("by_session", (q) => q.eq("sessionId", latest.sessionId))
			.collect();
		return sets
			.filter((set) => set.userId === userId && set.exerciseId === exerciseId)
			.sort((a, b) => a.setNumber - b.setNumber);
	},
});

async function latestSetForExercise(
	ctx: QueryCtx,
	userId: string,
	exerciseId: string,
	excludeSessionId?: Id<"workoutSessions">,
) {
	const history = ctx.db
		.query("sets")
		.withIndex("by_user_exercise_logged_at", (q) =>
			q.eq("userId", userId).eq("exerciseId", exerciseId),
		)
		.order("desc");
	// Stops at the first eligible row, reading only the excluded session's rows
	// ahead of it, rather than loading the whole history.
	for await (const set of history)
		if (set.sessionId !== excludeSessionId) return set;
	return null;
}

export const remove = mutation({
	args: { id: v.id("sets") },
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		const set = await requireOwned(ctx, userId, id);
		await ctx.db.delete(id);
		await recalcStrengthReferences(ctx, userId, set.exerciseId);
	},
});
