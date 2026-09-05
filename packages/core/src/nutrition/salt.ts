import { ABSENT, type NutrientValue, TRACE, nutrientValue } from "./nutrients";

/**
 * NEVO ships sodium (`NA`, mg) and no salt column at all. Where NEVO takes a
 * salt figure off a label it converts it *in* at `salt g × 0.4 × 1000 = mg
 * sodium`, so ×2.5/1000 is the exact inverse of NEVO's own factor.
 *
 * It is still a figure NEVO does not publish, which is why salt is marked as an
 * Appelent-derived addition everywhere it is shown.
 */
export const SALT_FROM_SODIUM_FACTOR = 2.5;
export const SALT_FROM_SODIUM_DIVISOR = 1000;

export const SALT_DERIVATION = Object.freeze({
	nutrient: "salt" as const,
	from: "sodium" as const,
	formula: "salt (g) = sodium (mg) × 2.5 / 1000",
	origin: "appelent-derived" as const,
	rationale:
		"NEVO publishes no salt column. 2.5 is the exact inverse of NEVO's own salt→sodium conversion factor (0.4).",
});

/**
 * Derive salt from a sodium reading, preserving state.
 *
 * Absent sodium yields absent salt — a food whose sodium NEVO never measured
 * has an unknown salt content, not a zero one. Trace sodium yields trace salt
 * for the same reason: the source said "traces", and inventing 0.000 g of salt
 * from it would claim more precision than exists.
 */
export function saltFromSodium(sodium: NutrientValue): NutrientValue {
	if (sodium.kind === "absent") return ABSENT;
	if (sodium.kind === "trace") return TRACE;
	return nutrientValue((sodium.amount * SALT_FROM_SODIUM_FACTOR) / SALT_FROM_SODIUM_DIVISOR);
}

/** True for nutrients Workouts derives rather than reads from the source. */
export function isDerivedNutrient(key: string): boolean {
	return key === "salt";
}
