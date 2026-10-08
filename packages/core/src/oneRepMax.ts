export interface OneRepMaxResult {
	value: number;
	source: "actual" | "calculated";
	formula?: "epley";
}

/** International avoirdupois pound; preserve precision until display/rounding. */
export function convertLoad(
	value: number,
	from: "kg" | "lbs",
	to: "kg" | "lbs",
) {
	if (from === to) return value;
	return from === "lbs" ? value * 0.45359237 : value / 0.45359237;
}

/**
 * Calculate 1RM using the Epley formula.
 * - reps === 1: weight is the actual 1RM (no formula)
 * - reps > 1: 1RM = weight × (1 + reps / 30), rounded to 1 decimal
 */
export function calculateOneRepMax(
	weight: number,
	reps: number,
): OneRepMaxResult {
	if (reps === 1) {
		return { value: weight, source: "actual" };
	}
	const raw = weight * (1 + reps / 30);
	const value = Math.round(raw * 10) / 10;
	return { value, source: "calculated", formula: "epley" };
}

/** Approximate max reps at RPE 10. The measured single is a separate boundary. */
export function estimatedMaxReps(
	reference: number,
	load: number,
): number | null {
	if (
		!Number.isFinite(reference) ||
		!Number.isFinite(load) ||
		reference <= 0 ||
		load <= 0
	)
		return null;
	if (load > reference) return 0;
	if (load === reference) return 1;
	return Math.max(1, Math.floor(30 * (reference / load - 1) + 1e-9));
}

export function weightForRepMax(reference: number, reps: number): number {
	return reps === 1 ? reference : reference / (1 + reps / 30);
}

export function roundLoad(load: number, step: number): number {
	if (!Number.isFinite(load) || !Number.isFinite(step) || step <= 0) return 0;
	return Math.max(0, Math.round(Math.round(load / step) * step * 1e6) / 1e6);
}

const EQUIPMENT_STEPS = {
	barbell: 2.5,
	dumbbell: 1,
	cable: 5,
	machine: 5,
	kettlebell: 4,
	band: 2.5,
	bodyweight: 2.5,
	other: 2.5,
};
export function getWeightStep(
	equipment: keyof typeof EQUIPMENT_STEPS,
	increment?: number,
) {
	return increment !== undefined && Number.isFinite(increment) && increment > 0
		? increment
		: EQUIPMENT_STEPS[equipment];
}
