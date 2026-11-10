import {
	type LoadUnit,
	SET_LIMITS,
	validatePlannedExercise,
} from "@foundry/core";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireOwned } from "./auth";
import { appError, checked } from "./errors";
import { requireExercise } from "./exerciseCatalog";
import { snapshotStrengthReferences } from "./strengthReferences";

/**
 * One exercise a session starts with, by its canonical id; `sets: 0` adds it
 * without targets.
 */
export type Prescription = {
	exerciseId: string;
	sets: number;
	reps: number;
	weight: number;
	unit: LoadUnit;
};

export function validatePrescriptions(
	prescriptions: readonly Prescription[],
	{ setsRequired = false } = {},
) {
	if (prescriptions.length > SET_LIMITS.exercisesPerPrescription.max)
		throw appError("tooLarge", "exercises");
	for (const { sets, reps, weight } of prescriptions)
		checked(
			validatePlannedExercise({
				...(sets === 0 && !setsRequired ? {} : { plannedSets: sets }),
				plannedReps: reps,
				plannedWeight: weight,
			}),
		);
}

export async function getActiveSession(
	ctx: QueryCtx | MutationCtx,
	userId: string,
) {
	return ctx.db
		.query("workoutSessions")
		.withIndex("by_user_status", (q) =>
			q.eq("userId", userId).eq("status", "active"),
		)
		.first();
}

/**
 * Starts the user's one active session, with every prescribed exercise's
 * One-rep Max references snapshotted at the start. The caller has resolved
 * the exercise ids: a hosted workout may name the host's personal exercise.
 */
export async function startSession(
	ctx: MutationCtx,
	userId: string,
	session: {
		name?: string;
		date?: number;
		routineId?: Id<"routines">;
		prescriptions: readonly Prescription[];
	},
) {
	if (await getActiveSession(ctx, userId))
		throw appError("activeSessionExists");
	validatePrescriptions(session.prescriptions);
	const exercises: NonNullable<Doc<"workoutSessions">["exercises"]> = [];
	for (const prescription of session.prescriptions) {
		const { exerciseId } = prescription;
		let entry = exercises.find((item) => item.exerciseId === exerciseId);
		if (!entry) {
			entry = {
				exerciseId,
				references: await snapshotStrengthReferences(ctx, userId, exerciseId),
				plannedSets: [],
			};
			exercises.push(entry);
		}
		const { reps, weight, unit } = prescription;
		for (let set = 0; set < prescription.sets; set++)
			entry.plannedSets.push({ reps, weight, unit });
	}
	const now = Date.now();
	return ctx.db.insert("workoutSessions", {
		userId,
		date: session.date ?? now,
		startTime: now,
		name: session.name,
		routineId: session.routineId,
		exercises,
		status: "active",
	});
}

/** The prescriptions of a hosted workout's strength blocks that name an exercise. */
export function hostedPrescriptions(
	blocks: Doc<"hostedWorkouts">["template"]["strengthBlocks"],
): Prescription[] {
	return blocks.flatMap((block) =>
		block.exerciseId
			? [
					{
						exerciseId: block.exerciseId,
						sets: block.defaultSets ?? 0,
						reps: block.defaultReps ?? 0,
						weight: block.defaultWeight ?? 0,
						unit: block.unit ?? "kg",
					},
				]
			: [],
	);
}

export async function requireActiveSession(
	ctx: MutationCtx,
	userId: string,
	sessionId: Id<"workoutSessions">,
) {
	const session = await requireOwned(ctx, userId, sessionId);
	if (session.status !== "active") throw appError("sessionEnded");
	return session;
}

/** Adds an exercise to an active session, snapshotting its references once. */
export async function ensureSessionExercise(
	ctx: MutationCtx,
	userId: string,
	sessionId: Id<"workoutSessions">,
	id: string,
) {
	const session = await requireActiveSession(ctx, userId, sessionId);
	const exerciseId = await requireExercise(ctx, id, userId);
	const exercises = session.exercises ?? [];
	const existing = exercises.find(
		(exercise) => exercise.exerciseId === exerciseId,
	);
	if (!existing?.references) {
		const entry = {
			exerciseId,
			plannedSets: existing?.plannedSets ?? [],
			references: await snapshotStrengthReferences(ctx, userId, exerciseId),
		};
		await ctx.db.patch(sessionId, {
			exercises: existing
				? exercises.map((exercise) =>
						exercise === existing ? entry : exercise,
					)
				: [...exercises, entry],
		});
	}
	return exerciseId;
}
