export const LOAD_UNITS = ["kg", "lbs"] as const;
export type LoadUnit = (typeof LOAD_UNITS)[number];

/** International avoirdupois pound. */
export const KG_PER_LB = 0.45359237;

/** Keeps full precision; round only for display. */
export function convertLoad(value: number, from: LoadUnit, to: LoadUnit) {
	if (from === to) return value;
	return from === "lbs" ? value * KG_PER_LB : value / KG_PER_LB;
}

export function toKg(value: number, unit: LoadUnit) {
	return convertLoad(value, unit, "kg");
}

/** `cal` is a machine-calorie target (rower, bike), not a length. */
export const DISTANCE_UNITS = ["m", "km", "mi", "cal"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];
