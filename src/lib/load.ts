import type { Doc } from "@convex/_generated/dataModel";
import { convertLoad, type LoadUnit } from "@foundry/core";

/** A kg load in `unit`, rounded to one decimal for display. */
export function displayLoad(kg: number, unit: LoadUnit): number {
	return Math.round(convertLoad(kg, "kg", unit) * 10) / 10;
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
