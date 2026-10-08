import { calculateOneRepMax, convertLoad } from "@workouts/core";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { canonicalExerciseId, exerciseOneRepMaxes, exerciseReferenceIds, resolveExercise } from "./exerciseCatalog";

export const strengthReferenceSnapshot = v.object({
	value: v.number(),
	unit: v.union(v.literal("kg"), v.literal("lbs")),
	date: v.number(),
	source: v.union(v.literal("actual"), v.literal("calculated"), v.literal("manual")),
	sourceSetId: v.optional(v.id("sets")),
	formula: v.optional(v.string()),
	performance: v.optional(v.object({ weight: v.number(), reps: v.number(), unit: v.union(v.literal("kg"), v.literal("lbs")) })),
});
export const strengthReferenceSnapshots = v.object({
	measured: v.union(v.null(), strengthReferenceSnapshot),
	estimated: v.union(v.null(), strengthReferenceSnapshot),
	manual: v.union(v.null(), strengthReferenceSnapshot),
});

export async function snapshotStrengthReferences(ctx: MutationCtx, userId: string, exerciseId: string) {
	const references = await readStrengthReferences(ctx, userId, exerciseId);
	const copy = async (reference: Doc<"oneRepMaxes"> | null) => {
  if (!reference) return null;
  const source = reference.sourceSetId ? await ctx.db.get(reference.sourceSetId) : null;
  return {
   value: reference.value, unit: reference.unit, date: reference.date, source: reference.source,
   sourceSetId: reference.sourceSetId, formula: reference.formula,
   performance: source ? { weight: source.weight, reps: source.reps, unit: source.unit } : undefined,
  };
 };
 return { measured: await copy(references.measured), estimated: await copy(references.estimated), manual: await copy(references.manual) };
}

export async function performanceReference(ctx: MutationCtx, userId: string, set: Pick<Doc<"sets">, "exerciseId" | "weight" | "reps" | "unit" | "performanceVerified">) {
	const exercise = await resolveExercise(ctx, set.exerciseId, userId);
	if (!set.performanceVerified || !exercise || exercise.equipment === "bodyweight" || set.weight <= 0 || set.reps < 1) {
		return { referenceKind: undefined, referenceValueKg: undefined };
	}
	const result = calculateOneRepMax(set.weight, set.reps);
	return { referenceKind: result.source, referenceValueKg: convertLoad(result.value, set.unit, "kg") };
}

export async function recalcStrengthReferences(ctx: MutationCtx, userId: string, id: string) {
	const exerciseId = await canonicalExerciseId(ctx, id);
	const existing = await exerciseOneRepMaxes(ctx, userId, exerciseId);
	// Keep manual and unverified historical records intact. Only this derivation's
	// sourced summaries are replaceable, and its ranked index bounds history reads.
	for (const reference of existing) if (reference.sourceSetId) await ctx.db.delete(reference._id);
	const ids = await exerciseReferenceIds(ctx, exerciseId);
	for (const source of ["actual", "calculated"] as const) {
		const candidates = (await Promise.all(ids.map((referenceId) => ctx.db.query("sets")
			.withIndex("by_strength_reference", q => q.eq("userId", userId).eq("exerciseId", referenceId).eq("referenceKind", source))
			.order("desc").first()))).filter((set): set is Doc<"sets"> => set !== null);
		const best = candidates.sort((a, b) => (b.referenceValueKg ?? 0) - (a.referenceValueKg ?? 0) || b.loggedAt - a.loggedAt)[0];
		if (!best) continue;
		const result = calculateOneRepMax(best.weight, best.reps);
		await ctx.db.insert("oneRepMaxes", { userId, exerciseId, ...result, unit: best.unit, date: best.loggedAt, sourceSetId: best._id });
	}
}

export async function readStrengthReferences(ctx: QueryCtx | MutationCtx, userId: string, exerciseId: string) {
	const records = await exerciseOneRepMaxes(ctx, userId, exerciseId);
	const exercise = await resolveExercise(ctx, exerciseId, userId);
	const automatic = exercise?.equipment === "bodyweight" ? [] : records.filter(record => record.sourceSetId);
	const best = (source: "actual" | "calculated") => automatic.filter(record => record.source === source)
		.sort((a, b) => convertLoad(b.value, b.unit, "kg") - convertLoad(a.value, a.unit, "kg"))[0] ?? null;
	const manual = records.filter(record => record.source === "manual").sort((a, b) => b.date - a.date || b._creationTime - a._creationTime)[0] ?? null;
	return { measured: best("actual"), estimated: best("calculated"), manual };
}
