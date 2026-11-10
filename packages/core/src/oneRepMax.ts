/** How a logged set gives a One-rep Max: a performed single, or the Epley estimate. */
export const SET_REFERENCE_SOURCES = ["actual", "calculated"] as const;
export type SetReferenceSource = (typeof SET_REFERENCE_SOURCES)[number];

export interface OneRepMaxResult {
	value: number;
	source: SetReferenceSource;
	formula?: "epley";
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
