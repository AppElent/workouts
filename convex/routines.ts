import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireOwned, requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";
import { requireExercise, resolveExercise } from "./lib/exerciseCatalog";
import { withCreateReceipt } from "./lib/operationReceipt";
import {
	type Prescription,
	startSession as startStrengthSession,
	validatePrescriptions,
} from "./lib/strengthSession";
import { exerciseReference } from "./lib/validators";

export const MAX_ROUTINE_NAME_LENGTH = 200;

/**
 * Bounds on a Routine at save time so `startSession` stays well under Convex's
 * 8,192 array-element and 1 MiB document limits when expanding `exercises`
 * into `plannedSets` and snapshotting per-exercise strength references.
 */
export const MAX_ROUTINE_EXERCISES = 50;
export const MAX_ROUTINE_TOTAL_SETS = 500;

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

async function checkedRoutine(
	ctx: MutationCtx,
	userId: string,
	input: { name: string; exercises: RoutineExercise[] },
) {
	const name = input.name.trim();
	if (!name) throw appError("required", "name");
	if (name.length > MAX_ROUTINE_NAME_LENGTH)
		throw appError("routineNameTooLong", "name");
	if (input.exercises.length === 0) throw appError("required", "exercises");
	if (input.exercises.length > MAX_ROUTINE_EXERCISES)
		throw appError("routineTooLarge", "exercises");
	const prescriptions = input.exercises.map(prescription);
	validatePrescriptions(prescriptions, { setsRequired: true });
	const totalSets = prescriptions.reduce((total, { sets }) => total + sets, 0);
	if (totalSets > MAX_ROUTINE_TOTAL_SETS)
		throw appError("routineTooLarge", "exercises");
	const exercises = await Promise.all(
		input.exercises.map(async (exercise) => ({
			...exercise,
			exerciseId: await requireExercise(ctx, exercise.exerciseId, userId),
		})),
	);
	const seen = new Set<string>();
	for (const exercise of exercises) {
		if (seen.has(exercise.exerciseId))
			throw appError("routineDuplicateExercise", "exercises");
		seen.add(exercise.exerciseId);
	}
	return { name, exercises };
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
	args: {
		operationId: v.optional(v.string()),
		name: v.string(),
		exercises: v.array(routineExercise),
	},
	returns: v.id("routines"),
	handler: async (ctx, { operationId, name, exercises }) => {
		const userId = await requireUserId(ctx);
		return withCreateReceipt(
			ctx,
			userId,
			{ operationId, kind: "routine", payload: { name, exercises } },
			async () => {
				const routine = await checkedRoutine(ctx, userId, { name, exercises });
				return ctx.db.insert("routines", { userId, ...routine });
			},
		);
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
	returns: v.null(),
	handler: async (ctx, { id, name, exercises }) => {
		const userId = await requireUserId(ctx);
		await requireOwned(ctx, userId, id);
		const routine = await checkedRoutine(ctx, userId, { name, exercises });
		await ctx.db.patch(id, routine);
		return null;
	},
});

export const startSession = mutation({
	args: {
		routineId: v.id("routines"),
		/** For a session logged afterwards; defaults to now. */
		startTime: v.optional(v.number()),
	},
	handler: async (ctx, { routineId, startTime }) => {
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
			startTime,
			routineId,
			prescriptions,
		});
	},
});
