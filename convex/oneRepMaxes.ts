import {
	calculateOneRepMax,
	currentOneRepMax,
	resolveStrengthReferences,
} from "@foundry/core";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	canonicalExerciseId,
	exerciseOneRepMaxes,
	exerciseReference,
	normalizeExerciseReferences,
	requireExercise,
	resolveExercise,
} from "./lib/exerciseCatalog";
import { readStrengthReferences } from "./lib/strengthReferences";
import { assertRange } from "./lib/validate";

async function requireUser(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthenticated");
	return identity.subject;
}

export const getReferences = query({
	args: { exerciseId: exerciseReference },
	handler: async (ctx, { exerciseId }) => {
		const userId = await requireUser(ctx);
		return readStrengthReferences(
			ctx,
			userId,
			await canonicalExerciseId(ctx, exerciseId),
		);
	},
});

export const getCurrentForExercise = query({
	args: { exerciseId: exerciseReference },
	handler: async (ctx, { exerciseId }) => {
		const userId = await requireUser(ctx);
		exerciseId = await canonicalExerciseId(ctx, exerciseId);
		return (
			currentOneRepMax(await readStrengthReferences(ctx, userId, exerciseId))
				?.reference ?? null
		);
	},
});

export const listCurrentForUser = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUser(ctx);
		const all = await ctx.db
			.query("oneRepMaxes")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		const byExercise = new Map<string, Doc<"oneRepMaxes">[]>();
		for (const record of await normalizeExerciseReferences(ctx, all)) {
			const records = byExercise.get(record.exerciseId) ?? [];
			records.push(record);
			byExercise.set(record.exerciseId, records);
		}
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
		const userId = await requireUser(ctx);
		exerciseId = await canonicalExerciseId(ctx, exerciseId);
		return (await exerciseOneRepMaxes(ctx, userId, exerciseId)).sort(
			(a, b) => a._creationTime - b._creationTime,
		);
	},
});

export const addManual = mutation({
	args: {
		exerciseId: exerciseReference,
		value: v.number(),
		unit: v.union(v.literal("kg"), v.literal("lbs")),
		date: v.optional(v.number()),
	},
	handler: async (ctx, { exerciseId, value, unit, date }) => {
		const userId = await requireUser(ctx);
		assertRange(value, 1, 2000, "1RM");
		exerciseId = await requireExercise(ctx, exerciseId, userId);
		return ctx.db.insert("oneRepMaxes", {
			userId,
			exerciseId,
			value,
			unit,
			date: date ?? Date.now(),
			source: "manual",
		});
	},
});

export const calculateAndStore = mutation({
	args: {
		exerciseId: exerciseReference,
		weight: v.number(),
		reps: v.number(),
		unit: v.union(v.literal("kg"), v.literal("lbs")),
	},
	handler: async (ctx, { exerciseId, weight, reps, unit }) => {
		const userId = await requireUser(ctx);
		assertRange(weight, 0, 2000, "Weight");
		assertRange(reps, 1, 1000, "Reps");
		exerciseId = await requireExercise(ctx, exerciseId, userId);
		const all = await exerciseOneRepMaxes(ctx, userId, exerciseId);
		if (all.some((orm) => orm.source === "manual")) return;
		const { value, source, formula } = calculateOneRepMax(weight, reps);
		const current = all
			.filter((orm) => orm.source !== "manual" && !orm.sourceSetId)
			.sort((a, b) => b.value - a.value)[0];
		if (current && value <= current.value) return;
		if (current) await ctx.db.delete(current._id);
		await ctx.db.insert("oneRepMaxes", {
			userId,
			exerciseId,
			value,
			unit,
			date: Date.now(),
			source,
			formula,
		});
	},
});
