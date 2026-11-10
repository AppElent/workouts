import {
	calculateOneRepMax,
	convertLoad,
	isReferenceEligible,
	resolveStrengthReferences,
} from "@foundry/core";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { exerciseOneRepMaxes, resolveExercise } from "./exerciseCatalog";

export async function snapshotStrengthReferences(
	ctx: MutationCtx,
	userId: string,
	exerciseId: string,
) {
	const references = await readStrengthReferences(ctx, userId, exerciseId);
	const copy = async (reference: Doc<"oneRepMaxes"> | null) => {
		if (!reference) return null;
		const source = reference.sourceSetId
			? await ctx.db.get(reference.sourceSetId)
			: null;
		return {
			value: reference.value,
			unit: reference.unit,
			date: reference.date,
			source: reference.source,
			sourceSetId: reference.sourceSetId,
			formula: reference.formula,
			performance: source
				? { weight: source.weight, reps: source.reps, unit: source.unit }
				: undefined,
		};
	};
	return {
		measured: await copy(references.measured),
		estimated: await copy(references.estimated),
		manual: await copy(references.manual),
	};
}

export async function performanceReference(
	ctx: MutationCtx,
	userId: string,
	set: Pick<
		Doc<"sets">,
		"exerciseId" | "weight" | "reps" | "unit" | "performanceVerified"
	>,
) {
	const exercise = await resolveExercise(ctx, set.exerciseId, userId);
	if (!isReferenceEligible(set, exercise)) {
		return { referenceKind: undefined, referenceValueKg: undefined };
	}
	const result = calculateOneRepMax(set.weight, set.reps);
	return {
		referenceKind: result.source,
		referenceValueKg: convertLoad(result.value, set.unit, "kg"),
	};
}

/**
 * Rebuilds the set-derived One-rep Max summaries of one exercise from its best
 * actual and calculated sets. Manual entries and unsourced historical records
 * stay.
 */
export async function recalcStrengthReferences(
	ctx: MutationCtx,
	userId: string,
	exerciseId: string,
) {
	for (const reference of await exerciseOneRepMaxes(ctx, userId, exerciseId))
		if (reference.sourceSetId) await ctx.db.delete(reference._id);
	for (const source of ["actual", "calculated"] as const) {
		const best = await ctx.db
			.query("sets")
			.withIndex("by_strength_reference", (q) =>
				q
					.eq("userId", userId)
					.eq("exerciseId", exerciseId)
					.eq("referenceKind", source),
			)
			.order("desc")
			.first();
		if (!best) continue;
		await ctx.db.insert("oneRepMaxes", {
			userId,
			exerciseId,
			...calculateOneRepMax(best.weight, best.reps),
			unit: best.unit,
			date: best.loggedAt,
			sourceSetId: best._id,
		});
	}
}

export async function readStrengthReferences(
	ctx: QueryCtx | MutationCtx,
	userId: string,
	exerciseId: string,
) {
	return resolveStrengthReferences(
		await exerciseOneRepMaxes(ctx, userId, exerciseId),
		await resolveExercise(ctx, exerciseId, userId),
	);
}
