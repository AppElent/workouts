import {
	getWeightStep,
	type LoadUnit,
	percentOfOneRepMaxLoad,
	SET_LIMITS,
	sessionOneRepMax,
	validatePlannedExercise,
	validateRecordedTime,
} from "@foundry/core";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireOwned } from "./auth";
import { appError, checked } from "./errors";
import { requireExercise, resolveExercise } from "./exerciseCatalog";
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
 * A past `startTime` that matches a session already logged returns that
 * session, active or finished, so a connected app's retry is safe.
 */
export async function startSession(
	ctx: MutationCtx,
	userId: string,
	session: {
		name?: string;
		date?: number;
		/** When it started, for a session logged afterwards; defaults to now. */
		startTime?: number;
		routineId?: Id<"routines">;
		prescriptions: readonly Prescription[];
	},
) {
	const now = Date.now();
	const startTime =
		session.startTime === undefined
			? now
			: checked(validateRecordedTime("startTime", session.startTime, now));
	if (session.startTime !== undefined) {
		// The same past start again is a retry of the first, even once it finished.
		const sameStart = await ctx.db
			.query("workoutSessions")
			.withIndex("by_user_date", (q) =>
				q.eq("userId", userId).eq("date", session.date ?? startTime),
			)
			.take(10);
		const logged = sameStart.find(
			(row) => row.startTime === startTime && row.status !== "cancelled",
		);
		if (logged) return logged._id;
	}
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
	return ctx.db.insert("workoutSessions", {
		userId,
		date: session.date ?? startTime,
		startTime,
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

/** One target of `planSessionExercise`: a load, or a share of the 1RM. */
export type PlannedTarget = {
	reps: number;
	weight?: number;
	percentOfOneRepMax?: number;
};

/**
 * Replaces an active session exercise's Planned Sets, adding the exercise when
 * needed. A percentage resolves against the 1RM the session shows for that
 * exercise, which is refreshed first while nothing is logged for it yet.
 */
export async function planSessionExercise(
	ctx: MutationCtx,
	userId: string,
	sessionId: Id<"workoutSessions">,
	id: string,
	unit: LoadUnit,
	targets: readonly PlannedTarget[],
) {
	if (targets.length > SET_LIMITS.plannedSets.max)
		throw appError("tooLarge", "plannedSets");
	const exerciseId = await ensureSessionExercise(ctx, userId, sessionId, id);
	const session = await requireActiveSession(ctx, userId, sessionId);
	const exercises = session.exercises ?? [];
	const entry = exercises.find((item) => item.exerciseId === exerciseId);
	if (!entry) throw appError("notFound", "exerciseId");
	const sessionSets = await ctx.db
		.query("sets")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.collect();
	const logged = sessionSets.some((set) => set.exerciseId === exerciseId);
	const references =
		!logged && targets.some((t) => t.percentOfOneRepMax !== undefined)
			? await snapshotStrengthReferences(ctx, userId, exerciseId)
			: entry.references;
	const exercise = await resolveExercise(ctx, exerciseId, userId);
	const stepKg = getWeightStep(
		exercise?.equipment ?? "barbell",
		exercise?.weightIncrement,
	);
	const oneRepMax = references ? sessionOneRepMax(references) : null;
	const plannedSets = targets.map(({ reps, weight, percentOfOneRepMax }) => {
		if ((weight === undefined) === (percentOfOneRepMax === undefined))
			throw appError("invalid", "weight");
		let load = weight ?? 0;
		if (percentOfOneRepMax !== undefined) {
			checked(validatePlannedExercise({ percentOfOneRepMax }));
			if (!oneRepMax) throw appError("unavailable", "oneRepMax");
			load = percentOfOneRepMaxLoad(
				oneRepMax.reference,
				percentOfOneRepMax,
				unit,
				stepKg,
			);
		}
		checked(
			validatePlannedExercise({ plannedReps: reps, plannedWeight: load }),
		);
		return { reps, weight: load, unit };
	});
	await ctx.db.patch(sessionId, {
		exercises: exercises.map((item) =>
			item === entry ? { ...item, references, plannedSets } : item,
		),
	});
	return {
		exerciseId,
		plannedSets,
		oneRepMax: oneRepMax && {
			value: oneRepMax.reference.value,
			unit: oneRepMax.reference.unit,
			kind: oneRepMax.kind,
		},
	};
}
