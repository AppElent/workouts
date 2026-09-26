import {
	getShippedExercise,
	getShippedExerciseByName,
} from "@workouts/core/exercises";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

// Shipped references are application keys, not Convex document IDs. Mutations
// additionally resolve the key against the bundled catalog or an owned record.
export const exerciseReference = v.string();
export const exerciseDocument = v.object({
	_id: v.id("exercises"),
	_creationTime: v.number(),
	name: v.string(),
	muscleGroups: v.array(v.string()),
	category: v.union(v.literal("compound"), v.literal("isolation")),
	equipment: v.union(
		...(
			[
				"barbell",
				"dumbbell",
				"cable",
				"bodyweight",
				"machine",
				"kettlebell",
				"band",
				"other",
			] as const
		).map((value) => v.literal(value)),
	),
	notes: v.optional(v.string()),
	instructions: v.optional(v.array(v.string())),
	weightIncrement: v.optional(v.number()),
	isDefault: v.boolean(),
	shippedExerciseId: v.optional(v.string()),
	userId: v.optional(v.string()),
});
export async function canonicalExerciseId(
	ctx: QueryCtx | MutationCtx,
	id: string,
): Promise<string> {
	if (getShippedExercise(id)) return id;
	const documentId = ctx.db.normalizeId("exercises", id);
	if (!documentId) return id;
	const exercise = await ctx.db.get(documentId);
	if (!exercise?.isDefault) return id;
	return (
		exercise.shippedExerciseId ??
		getShippedExerciseByName(exercise.name)?._id ??
		id
	);
}

// During rollout, a history query must include both sides of a partially migrated
// exercise. After verification it uses only the shipped ID. No client map is needed.
export async function exerciseReferenceIds(
	ctx: QueryCtx | MutationCtx,
	id: string,
) {
	const canonical = await canonicalExerciseId(ctx, id);
	const shipped = getShippedExercise(canonical);
	if (!shipped) return [canonical];
	const migration = await ctx.db
		.query("exerciseMigrations")
		.withIndex("by_key", (q) => q.eq("key", "shipped-v1"))
		.unique();
	if (migration?.phase === "complete" && !migration.dryRun) return [canonical];
	const legacy = await ctx.db
		.query("exercises")
		.withIndex("by_default_name", (q) =>
			q.eq("isDefault", true).eq("name", shipped.name),
		)
		.take(1000);
	const pinned = await ctx.db
		.query("exercises")
		.withIndex("by_shipped", (q) => q.eq("shippedExerciseId", canonical))
		.take(1000);
	if (legacy.length === 1000 || pinned.length === 1000)
		throw new Error(
			"Too many duplicate legacy exercises; complete the exercise migration first.",
		);
	return [
		...new Set([
			canonical,
			...legacy.map((exercise) => exercise._id),
			...pinned.map((exercise) => exercise._id),
		]),
	];
}

export async function normalizeExerciseReferences<
	T extends { exerciseId: string },
>(ctx: QueryCtx | MutationCtx, records: T[]): Promise<T[]> {
	const ids = new Map<string, string>();
	for (const id of new Set(records.map((record) => record.exerciseId)))
		ids.set(id, await canonicalExerciseId(ctx, id));
	return records.map((record) => ({
		...record,
		exerciseId: ids.get(record.exerciseId) ?? record.exerciseId,
	}));
}

export async function normalizeExerciseTemplate(
	ctx: QueryCtx | MutationCtx,
	template: Doc<"hostedWorkouts">["template"],
) {
	return {
		...template,
		strengthBlocks: await Promise.all(
			template.strengthBlocks.map(async (block) =>
				block.exerciseId
					? {
							...block,
							exerciseId: await canonicalExerciseId(ctx, block.exerciseId),
						}
					: block,
			),
		),
	};
}

// Preserve the existing history API's complete-result semantics while querying
// only the signed-in user's indexed references during the migration window.
export async function exerciseSets(
	ctx: QueryCtx | MutationCtx,
	userId: string,
	id: string,
) {
	const ids = await exerciseReferenceIds(ctx, id);
	return (
		await Promise.all(
			ids.map((exerciseId) =>
				ctx.db
					.query("sets")
					.withIndex("by_user_exercise", (q) =>
						q.eq("userId", userId).eq("exerciseId", exerciseId),
					)
					.collect(),
			),
		)
	).flat();
}
export async function exerciseOneRepMaxes(
	ctx: QueryCtx | MutationCtx,
	userId: string,
	id: string,
) {
	const ids = await exerciseReferenceIds(ctx, id);
	return (
		await Promise.all(
			ids.map((exerciseId) =>
				ctx.db
					.query("oneRepMaxes")
					.withIndex("by_user_exercise", (q) =>
						q.eq("userId", userId).eq("exerciseId", exerciseId),
					)
					.collect(),
			),
		)
	).flat();
}

export async function resolveExercise(
	ctx: QueryCtx | MutationCtx,
	id: string,
	userId?: string,
) {
	const shipped = getShippedExercise(id);
	if (shipped) return shipped;
	const documentId = ctx.db.normalizeId("exercises", id);
	if (!documentId) return null;
	const exercise = await ctx.db.get(documentId);
	return exercise &&
		(exercise.isDefault || (userId !== undefined && exercise.userId === userId))
		? exercise
		: null;
}

export async function requireExercise(
	ctx: MutationCtx,
	id: string,
	userId: string,
) {
	if (!(await resolveExercise(ctx, id, userId)))
		throw new Error("Exercise not found");
	return canonicalExerciseId(ctx, id);
}
