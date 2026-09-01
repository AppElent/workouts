export type Unit = "kg" | "lbs";

// Standard loadable plates per side, heaviest first.
const PLATES: Record<Unit, number[]> = {
	kg: [25, 20, 15, 10, 5, 2.5, 1.25],
	lbs: [45, 35, 25, 10, 5, 2.5],
};

export const DEFAULT_BAR: Record<Unit, number> = { kg: 20, lbs: 45 };

export interface PlateResult {
	/** Plates to load on each side, heaviest first. */
	perSide: number[];
	/** Weight that couldn't be matched by available plates (each side total ×2). */
	remainder: number;
	/** True when the target is below the bar weight. */
	belowBar: boolean;
}

/**
 * Greedy plate breakdown for one side of the bar. Assumes a symmetric load.
 * `remainder` is non-zero when the target can't be hit exactly with the
 * standard plate set (e.g. an odd total).
 */
export function calcPlates(
	target: number,
	bar: number,
	unit: Unit,
): PlateResult {
	if (target < bar) {
		return { perSide: [], remainder: 0, belowBar: true };
	}
	let perSideWeight = (target - bar) / 2;
	const perSide: number[] = [];
	for (const plate of PLATES[unit]) {
		while (perSideWeight >= plate - 1e-9) {
			perSide.push(plate);
			perSideWeight -= plate;
		}
	}
	// Round to avoid floating-point dust.
	const remainder = Math.round(perSideWeight * 2 * 100) / 100;
	return { perSide, remainder, belowBar: false };
}

export interface WarmupSet {
	weight: number;
	reps: number;
	pct: number | null; // null = empty bar
}

/**
 * A simple, widely-used warmup ramp toward a working weight: empty bar, then
 * ~40/60/80% of the work set. Weights are rounded to the nearest loadable
 * increment (smallest plate ×2).
 */
export function generateWarmup(
	workWeight: number,
	bar: number,
	unit: Unit,
): WarmupSet[] {
	if (workWeight <= bar) return [];
	const increment = (PLATES[unit].at(-1) ?? 1.25) * 2;
	const roundToBar = (w: number) =>
		Math.max(bar, Math.round(w / increment) * increment);
	const steps: { pct: number; reps: number }[] = [
		{ pct: 0.4, reps: 5 },
		{ pct: 0.6, reps: 3 },
		{ pct: 0.8, reps: 2 },
	];
	const sets: WarmupSet[] = [{ weight: bar, reps: 8, pct: null }];
	for (const step of steps) {
		const w = roundToBar(workWeight * step.pct);
		if (w < workWeight)
			sets.push({ weight: w, reps: step.reps, pct: step.pct });
	}
	return sets;
}
