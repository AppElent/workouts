import {
	getShippedExercise,
	getShippedExerciseByName,
} from "@foundry/core/exercises";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import schema from "../schema";
import { appError } from "./errors";

export const exerciseDocument = v.object({
	_id: v.id("exercises"),
	_creationTime: v.number(),
	...schema.tables.exercises.validator.fields,
});

/**
 * The stored form of an exercise reference. The old database copies of the
 * shipped catalog (`isDefault` rows) map to their shipped key, so a stale
 * client id still lands on the shipped exercise.
 */
async function canonicalExerciseId(
	ctx: QueryCtx | MutationCtx,
	id: string,
): Promise<string> {
	if (getShippedExercise(id)) return id;
	const documentId = ctx.db.normalizeId("exercises", id);
	const exercise = documentId ? await ctx.db.get(documentId) : null;
	if (!exercise?.isDefault) return id;
	return (
		exercise.shippedExerciseId ??
		getShippedExerciseByName(exercise.name)?._id ??
		id
	);
}

/** A shipped exercise, or a personal exercise owned by `userId`. */
export async function resolveExercise(
	ctx: QueryCtx | MutationCtx,
	id: string,
	userId: string | null,
) {
	const shipped = getShippedExercise(id);
	if (shipped) return shipped;
	const documentId = ctx.db.normalizeId("exercises", id);
	if (!documentId || userId === null) return null;
	const exercise = await ctx.db.get(documentId);
	return exercise && !exercise.isDefault && exercise.userId === userId
		? exercise
		: null;
}

/** The canonical id of an exercise the caller may use; throws `notFound`. */
export async function requireExercise(
	ctx: QueryCtx | MutationCtx,
	id: string,
	userId: string,
) {
	const exerciseId = await canonicalExerciseId(ctx, id);
	if (!(await resolveExercise(ctx, exerciseId, userId)))
		throw appError("notFound", "exerciseId");
	return exerciseId;
}

export function exerciseSets(
	ctx: QueryCtx | MutationCtx,
	userId: string,
	exerciseId: string,
) {
	return ctx.db
		.query("sets")
		.withIndex("by_user_exercise", (q) =>
			q.eq("userId", userId).eq("exerciseId", exerciseId),
		)
		.collect();
}

export function exerciseOneRepMaxes(
	ctx: QueryCtx | MutationCtx,
	userId: string,
	exerciseId: string,
) {
	return ctx.db
		.query("oneRepMaxes")
		.withIndex("by_user_exercise", (q) =>
			q.eq("userId", userId).eq("exerciseId", exerciseId),
		)
		.collect();
}
