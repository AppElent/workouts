import { assertIntegerRange, assertRange } from "./validate";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { canonicalExerciseId, requireExercise } from "./exerciseCatalog";
import { snapshotStrengthReferences } from "./strengthReferences";

export async function requireActiveSession(ctx: MutationCtx, userId: string, sessionId: Id<"workoutSessions">) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.userId !== userId) throw new ConvexError("Unauthorized");
	if (session.status !== "active") throw new ConvexError("This session has ended.");
	return session;
}

export async function ensureSessionExercise(ctx: MutationCtx, userId: string, sessionId: Id<"workoutSessions">, id: string) {
	const session = await requireActiveSession(ctx, userId, sessionId);
	const exerciseId = await requireExercise(ctx, id, userId);
	const exercises = session.exercises ?? [];
	const existing = exercises.find((exercise) => exercise.exerciseId === exerciseId);
	if (!existing?.references) {
		const entry = { exerciseId, plannedSets: existing?.plannedSets ?? [], references: await snapshotStrengthReferences(ctx, userId, exerciseId) };
		await ctx.db.patch(sessionId, { exercises: existing ? exercises.map(exercise => exercise === existing ? entry : exercise) : [...exercises, entry] });
	}
	return exerciseId;
}

export async function hostedSessionExercises(ctx: MutationCtx, userId: string, blocks: Doc<"hostedWorkouts">["template"]["strengthBlocks"]) {
	const exercises: NonNullable<Doc<"workoutSessions">["exercises"]> = [];
	for (const block of blocks) {
		if (!block.exerciseId) continue;
		const exerciseId = await canonicalExerciseId(ctx, block.exerciseId);
		const existing = exercises.find(exercise => exercise.exerciseId === exerciseId);
		const entry = existing ?? { exerciseId, plannedSets: [], references: await snapshotStrengthReferences(ctx, userId, exerciseId) };
		assertIntegerRange(block.defaultSets ?? 0, 0, 100, "Planned sets");
  assertIntegerRange(block.defaultReps ?? 0, 0, 1000, "Planned reps");
  assertRange(block.defaultWeight ?? 0, 0, 2000, "Planned weight");
  entry.plannedSets.push(...Array.from({ length: block.defaultSets ?? 0 }, () => ({ reps: block.defaultReps ?? 0, weight: block.defaultWeight ?? 0, unit: block.unit ?? "kg" as const })));
		if (!existing) exercises.push(entry);
	}
	return exercises;
}
