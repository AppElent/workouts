import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireOwned, requireUserId } from "./lib/auth";
import { requireExercise, resolveExercise } from "./lib/exerciseCatalog";
import {
	type Prescription,
	startSession as startStrengthSession,
	validatePrescriptions,
} from "./lib/strengthSession";
import { exerciseReference } from "./lib/validators";

const routineExercise = v.object({
	exerciseId: exerciseReference,
	defaultSets: v.number(),
	defaultReps: v.number(),
	defaultWeight: v.optional(v.number()),
});

type RoutineExercise = typeof routineExercise.type;

function prescription(exercise: RoutineExercise): Prescription {
	return {
		exerciseId: exercise.exerciseId,
		sets: exercise.defaultSets,
		reps: exercise.defaultReps,
		weight: exercise.defaultWeight ?? 0,
		unit: "kg",
	};
}

async function checkedExercises(
	ctx: MutationCtx,
	userId: string,
	exercises: RoutineExercise[],
) {
	validatePrescriptions(exercises.map(prescription), { setsRequired: true });
	return Promise.all(
		exercises.map(async (exercise) => ({
			...exercise,
			exerciseId: await requireExercise(ctx, exercise.exerciseId, userId),
		})),
	);
}

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const routines = await ctx.db
			.query("routines")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.order("desc")
			.collect();
		return Promise.all(
			routines.map(async (routine) => ({
				...routine,
				exercises: await Promise.all(
					routine.exercises.map(async (exercise) => ({
						...exercise,
						exerciseName:
							(await resolveExercise(ctx, exercise.exerciseId, userId))?.name ??
							"Unknown",
					})),
				),
			})),
		);
	},
});

export const create = mutation({
	args: { name: v.string(), exercises: v.array(routineExercise) },
	handler: async (ctx, { name, exercises }) => {
		const userId = await requireUserId(ctx);
		return ctx.db.insert("routines", {
			userId,
			name,
			exercises: await checkedExercises(ctx, userId, exercises),
		});
	},
});

export const remove = mutation({
	args: { id: v.id("routines") },
	handler: async (ctx, { id }) => {
		await requireOwned(ctx, await requireUserId(ctx), id);
		await ctx.db.delete(id);
	},
});

export const update = mutation({
	args: {
		id: v.id("routines"),
		name: v.string(),
		exercises: v.array(routineExercise),
	},
	handler: async (ctx, { id, name, exercises }) => {
		const userId = await requireUserId(ctx);
		await requireOwned(ctx, userId, id);
		await ctx.db.patch(id, {
			name,
			exercises: await checkedExercises(ctx, userId, exercises),
		});
	},
});

export const startSession = mutation({
	args: { routineId: v.id("routines") },
	handler: async (ctx, { routineId }) => {
		const userId = await requireUserId(ctx);
		const routine = await requireOwned(ctx, userId, routineId);
		const prescriptions: Prescription[] = [];
		for (const exercise of routine.exercises)
			prescriptions.push({
				...prescription(exercise),
				exerciseId: await requireExercise(ctx, exercise.exerciseId, userId),
			});
		return startStrengthSession(ctx, userId, {
			name: routine.name,
			routineId,
			prescriptions,
		});
	},
});
