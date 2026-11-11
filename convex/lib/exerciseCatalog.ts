import { getShippedExercise } from "@foundry/core/exercises";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import schema from "../schema";
import { appError } from "./errors";

export const exerciseDocument = v.object({
	_id: v.id("exercises"),
	_creationTime: v.number(),
	...schema.tables.exercises.validator.fields,
});

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
	return exercise?.userId === userId ? exercise : null;
}

/** `id` when the caller may use that exercise; throws `notFound`. */
export async function requireExercise(
	ctx: QueryCtx | MutationCtx,
	id: string,
	userId: string,
) {
	if (!(await resolveExercise(ctx, id, userId)))
		throw appError("notFound", "exerciseId");
	return id;
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
