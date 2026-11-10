import type { Equipment } from "./exercise";
import {
	calculateOneRepMax,
	SET_REFERENCE_SOURCES,
	type SetReferenceSource,
	weightForRepMax,
} from "./oneRepMax";
import { type NumberRange, type RangeCode, rangeCode } from "./range";
import { type RuleResult, ruleIssues } from "./rules";
import { type LoadUnit, toKg } from "./units";

export const SET_TYPES = ["warmup", "working", "drop", "failure"] as const;
export type SetType = (typeof SET_TYPES)[number];

/** The rest between sets when the athlete has not chosen one. */
export const DEFAULT_REST_SECONDS = 90;

/**
 * Write limits for logged and planned strength work. Weights are checked in
 * the set's own unit, so 2000 lbs is as valid as 2000 kg.
 */
export const SET_LIMITS = {
	weight: { min: 0, max: 2000 },
	reps: { min: 0, max: 1000, step: 1 },
	rpe: { min: 1, max: 10, step: 0.5 },
	setNumber: { min: 1, max: 10_000, step: 1 },
	plannedSets: { min: 1, max: 100, step: 1 },
	plannedReps: { min: 0, max: 1000, step: 1 },
	plannedWeight: { min: 0, max: 2000 },
	exercisesPerPrescription: { min: 0, max: 100, step: 1 },
	manualOneRepMax: { min: 1, max: 2000 },
	/** A load picked as a percentage of the 1RM reference; above 0. */
	percentOfOneRepMax: { min: 0, max: 120 },
} as const satisfies Record<string, NumberRange>;

type SetLimitField = keyof typeof SET_LIMITS;
type SetLimitCode = RangeCode;

function checkLimits<T extends Partial<Record<SetLimitField, number | null>>>(
	input: T,
): RuleResult<T, SetLimitField, SetLimitCode> {
	const found = ruleIssues<SetLimitField, SetLimitCode>();
	for (const field of Object.keys(input) as SetLimitField[]) {
		const value = input[field];
		if (value === undefined || value === null || !(field in SET_LIMITS))
			continue;
		const code = rangeCode(value, SET_LIMITS[field]);
		if (code) found.add(field, code);
	}
	return found.result(input);
}

type SetInput = {
	weight?: number;
	reps?: number;
	/** `null` clears a saved RPE and is always valid. */
	rpe?: number | null;
	setNumber?: number;
};

/** Checks every present field of a logged set (a partial patch is fine). */
export function validateSetInput<T extends SetInput>(input: T) {
	return checkLimits(input);
}

type PlannedExerciseInput = {
	plannedSets?: number;
	plannedReps?: number;
	plannedWeight?: number;
};

/** One exercise of a routine or hosted prescription. */
export function validatePlannedExercise<T extends PlannedExerciseInput>(
	input: T,
) {
	return checkLimits(input);
}

export function validateManualOneRepMax(value: number) {
	return checkLimits({ manualOneRepMax: value });
}

export type PerformedSet = {
	weight: number;
	reps: number;
	unit: LoadUnit;
	/** Absent on legacy rows whose performance was never confirmed. */
	performanceVerified?: boolean;
	setType?: SetType;
};

/**
 * Whether a logged set may feed One-rep Max references: an explicitly logged
 * positive load with at least one rep, on an exercise that is not bodyweight.
 */
export function isReferenceEligible(
	set: Pick<PerformedSet, "weight" | "reps" | "performanceVerified">,
	exercise: { readonly equipment: Equipment } | null | undefined,
): boolean {
	return (
		set.performanceVerified === true &&
		!!exercise &&
		exercise.equipment !== "bodyweight" &&
		set.weight > 0 &&
		set.reps >= 1
	);
}

/** Total kg × reps; warm-ups are not work volume. */
export function workingVolume(
	sets: readonly Pick<PerformedSet, "weight" | "reps" | "unit" | "setType">[],
): number {
	return sets.reduce(
		(total, set) =>
			set.setType === "warmup"
				? total
				: total + toKg(set.weight, set.unit) * set.reps,
		0,
	);
}

type RecordedSet<T> = { set: T; valueKg: number };
type ExerciseRecords<T> = {
	/** Heaviest eligible load, ties to more reps. */
	heaviest: RecordedSet<T> | null;
	/** Highest Epley estimate from an eligible set. */
	bestEstimate: RecordedSet<T> | null;
	/** Largest eligible kg × reps in one set. */
	bestSetVolume: RecordedSet<T> | null;
	/** Most reps in one verified set, at any load (bodyweight included). */
	mostReps: T | null;
	/** Heaviest eligible load for each requested rep count that has one. */
	repMaxes: { reps: number; set: T; valueKg: number }[];
};

const DEFAULT_REP_TARGETS = [1, 3, 5, 10] as const;

/**
 * An exercise's records from its logged sets, with reference eligibility
 * applied and every load normalized to kg.
 */
export function exerciseRecords<T extends PerformedSet>(
	sets: readonly T[],
	exercise: { readonly equipment: Equipment } | null | undefined,
	repTargets: readonly number[] = DEFAULT_REP_TARGETS,
): ExerciseRecords<T> {
	const records: ExerciseRecords<T> = {
		heaviest: null,
		bestEstimate: null,
		bestSetVolume: null,
		mostReps: null,
		repMaxes: [],
	};
	const repMaxes = new Map<number, { set: T; valueKg: number }>();
	for (const set of sets) {
		if (
			set.performanceVerified === true &&
			set.reps >= 1 &&
			(!records.mostReps || set.reps > records.mostReps.reps)
		)
			records.mostReps = set;
		if (!isReferenceEligible(set, exercise)) continue;
		const kg = toKg(set.weight, set.unit);
		const heaviest = records.heaviest;
		if (
			!heaviest ||
			kg > heaviest.valueKg ||
			(kg === heaviest.valueKg && set.reps > heaviest.set.reps)
		)
			records.heaviest = { set, valueKg: kg };
		const estimate = calculateOneRepMax(kg, set.reps).value;
		if (!records.bestEstimate || estimate > records.bestEstimate.valueKg)
			records.bestEstimate = { set, valueKg: estimate };
		const volume = kg * set.reps;
		if (!records.bestSetVolume || volume > records.bestSetVolume.valueKg)
			records.bestSetVolume = { set, valueKg: volume };
		if (repTargets.includes(set.reps)) {
			const best = repMaxes.get(set.reps);
			if (!best || kg > best.valueKg)
				repMaxes.set(set.reps, { set, valueKg: kg });
		}
	}
	records.repMaxes = repTargets.flatMap((reps) => {
		const best = repMaxes.get(reps);
		return best ? [{ reps, ...best }] : [];
	});
	return records;
}

/** Predicted load for each rep count from a One-rep Max (inverse Epley). */
export function repMaxCurve(
	oneRepMax: number,
	reps: readonly number[],
): { reps: number; weight: number }[] {
	return reps.map((count) => ({
		reps: count,
		weight: weightForRepMax(oneRepMax, count),
	}));
}

export const STRENGTH_REFERENCE_SOURCES = [
	...SET_REFERENCE_SOURCES,
	"manual",
] as const;
export type StrengthReferenceSource =
	(typeof STRENGTH_REFERENCE_SOURCES)[number];
export type StrengthReferenceRecord = {
	value: number;
	unit: LoadUnit;
	date: number;
	source: StrengthReferenceSource;
	/** Present on references derived from a logged set. */
	sourceSetId?: unknown;
	_creationTime?: number;
};
type StrengthReferences<T> = {
	measured: T | null;
	estimated: T | null;
	manual: T | null;
};

/**
 * Resolves stored One-rep Max records into the account's references:
 * Measured and Estimated are the best set-derived records by kg (unsourced
 * legacy rows never count; bodyweight exercises have none), Manual is the
 * newest manual entry.
 */
export function resolveStrengthReferences<T extends StrengthReferenceRecord>(
	records: readonly T[],
	exercise: { readonly equipment: Equipment } | null | undefined,
): StrengthReferences<T> {
	const derived =
		exercise?.equipment === "bodyweight"
			? []
			: records.filter((record) => record.sourceSetId);
	const best = (source: SetReferenceSource) =>
		derived
			.filter((record) => record.source === source)
			.sort((a, b) => toKg(b.value, b.unit) - toKg(a.value, a.unit))[0] ?? null;
	const manual =
		records
			.filter((record) => record.source === "manual")
			.sort(
				(a, b) =>
					b.date - a.date || (b._creationTime ?? 0) - (a._creationTime ?? 0),
			)[0] ?? null;
	return { measured: best("actual"), estimated: best("calculated"), manual };
}

type SessionReferenceKind = "manual" | "measured";

/**
 * The One-rep Max a session's percentages use: Measured, unless a Manual 1RM
 * is newer (or there is no Measured).
 */
export function sessionOneRepMax<T extends { date: number }>(
	references: StrengthReferences<T>,
): { reference: T; kind: SessionReferenceKind } | null {
	const { measured, manual } = references;
	if (manual && (!measured || manual.date > measured.date))
		return { reference: manual, kind: "manual" };
	return measured ? { reference: measured, kind: "measured" } : null;
}

/**
 * The account's current One-rep Max for an exercise: the session rule, then
 * the Estimated reference when nothing was measured or entered.
 */
export function currentOneRepMax<T extends { date: number }>(
	references: StrengthReferences<T>,
): { reference: T; kind: SessionReferenceKind | "estimated" } | null {
	return (
		sessionOneRepMax(references) ??
		(references.estimated
			? { reference: references.estimated, kind: "estimated" }
			: null)
	);
}
