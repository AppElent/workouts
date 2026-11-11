import {
	currentOneRepMax,
	resolveStrengthReferences,
	validateManualOneRepMax,
} from "@foundry/core";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { checked } from "./lib/errors";
import {
	exerciseOneRepMaxes,
	requireExercise,
	resolveExercise,
} from "./lib/exerciseCatalog";
import { withCreateReceipt } from "./lib/operationReceipt";
import { readStrengthReferences } from "./lib/strengthReferences";
import { exerciseReference, loadUnit } from "./lib/validators";

export const getCurrentForExercise = query({
	args: { exerciseId: exerciseReference },
	handler: async (ctx, { exerciseId }) => {
		const userId = await requireUserId(ctx);
		return (
			currentOneRepMax(await readStrengthReferences(ctx, userId, exerciseId))
				?.reference ?? null
		);
	},
});

export const listCurrentForUser = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const all = await ctx.db
			.query("oneRepMaxes")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		const byExercise = new Map<string, Doc<"oneRepMaxes">[]>();
		for (const record of all)
			byExercise.set(record.exerciseId, [
				...(byExercise.get(record.exerciseId) ?? []),
				record,
			]);
		const current: Doc<"oneRepMaxes">[] = [];
		for (const [exerciseId, records] of byExercise) {
			const exercise = await resolveExercise(ctx, exerciseId, userId);
			const chosen = currentOneRepMax(
				resolveStrengthReferences(records, exercise),
			);
			if (chosen) current.push(chosen.reference);
		}
		return current;
	},
});

export const listForExercise = query({
	args: { exerciseId: exerciseReference },
	handler: async (ctx, { exerciseId }) => {
		const userId = await requireUserId(ctx);
		return (await exerciseOneRepMaxes(ctx, userId, exerciseId)).sort(
			(a, b) => a._creationTime - b._creationTime,
		);
	},
});

export const addManual = mutation({
	args: {
		operationId: v.optional(v.string()),
		exerciseId: exerciseReference,
		value: v.number(),
		unit: loadUnit,
		// Connected apps back-date a 1RM they were told about.
		date: v.optional(v.number()),
	},
	handler: async (ctx, { operationId, ...input }) => {
		const userId = await requireUserId(ctx);
		checked(validateManualOneRepMax(input.value));
		return withCreateReceipt(
			ctx,
			userId,
			{ operationId, kind: "oneRepMax", payload: input },
			async () =>
				ctx.db.insert("oneRepMaxes", {
					userId,
					exerciseId: await requireExercise(ctx, input.exerciseId, userId),
					value: input.value,
					unit: input.unit,
					date: input.date ?? Date.now(),
					source: "manual",
				}),
		);
	},
});
