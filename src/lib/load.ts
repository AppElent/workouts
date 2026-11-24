import type { Doc } from "@convex/_generated/dataModel";
import { convertLoad, isTimedExercise, type LoadUnit } from "@foundry/core";

/** A kg load in `unit`, rounded to one decimal for display. */
export function displayLoad(kg: number, unit: LoadUnit): number {
	return Math.round(convertLoad(kg, "kg", unit) * 10) / 10;
}

/** A set's count as it reads: "8" reps, or "45 s" on a hold. */
export function setCount(set: Pick<Doc<"sets">, "exerciseId" | "reps">) {
	return isTimedExercise(set.exerciseId) ? `${set.reps} s` : String(set.reps);
}

/** The server-stored 1RM reference of a set, in the set's own unit. */
export function setReference(set: Doc<"sets">) {
	if (!set.performanceVerified || !set.referenceKind || !set.referenceValueKg)
		return null;
	return {
		value: displayLoad(set.referenceValueKg, set.unit),
		kind: set.referenceKind,
	};
}

/**
 * The Overview hint for an exercise with no notes, or null when the Overview
 * already has content. A hold has no 1RM, so it asks for a best time instead.
 */
export function overviewHint(
	exerciseId: string,
	state: { signedIn: boolean; hasSets: boolean; hasOneRepMax: boolean },
): string | null {
	const timed = isTimedExercise(exerciseId);
	if (!state.signedIn) {
		return timed
			? "Sign in to track your best time for this exercise."
			: "Sign in to track your 1RM for this exercise.";
	}
	if (timed) {
		return state.hasSets
			? null
			: "No holds yet. Log a hold to see your best time.";
	}
	return state.hasOneRepMax
		? null
		: "No data yet. Log sets for this exercise to see your 1RM.";
}
