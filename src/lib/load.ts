import type { Doc } from "@convex/_generated/dataModel";
import { convertLoad, type LoadUnit } from "@foundry/core";

export { longestHold } from "@foundry/core";

/** A kg load in `unit`, rounded to one decimal for display. */
export function displayLoad(kg: number, unit: LoadUnit): number {
	return Math.round(convertLoad(kg, "kg", unit) * 10) / 10;
}

/** A set's count as it reads: "8" reps, or "45 s" on a hold. */
export function setCount(set: Pick<Doc<"sets">, "reps">, timed: boolean) {
	return timed ? `${set.reps} s` : String(set.reps);
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

/** Which Overview hint an exercise with no notes shows; see `overviewHint`. */
export type OverviewHint =
	| "signInHold"
	| "signInOneRepMax"
	| "noHolds"
	| "noOneRepMax";

/**
 * The Overview hint for an exercise with no notes, or null when the Overview
 * already has content. A hold has no 1RM, so it asks for a best time instead.
 */
export function overviewHint(
	timed: boolean,
	state: { signedIn: boolean; hasSets: boolean; hasOneRepMax: boolean },
): OverviewHint | null {
	if (!state.signedIn) return timed ? "signInHold" : "signInOneRepMax";
	if (timed) return state.hasSets ? null : "noHolds";
	return state.hasOneRepMax ? null : "noOneRepMax";
}
