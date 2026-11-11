export type NumberRange = {
	readonly min: number;
	readonly max: number;
	/** Values must be multiples of this step (1 for whole numbers). */
	readonly step?: number;
};

export type RangeCode = "notNumber" | "tooSmall" | "tooLarge" | "notStep";

/** The first way `value` breaks `range`, or null when it fits. */
export function rangeCode(value: number, range: NumberRange): RangeCode | null {
	if (!Number.isFinite(value)) return "notNumber";
	if (value < range.min) return "tooSmall";
	if (value > range.max) return "tooLarge";
	if (range.step !== undefined) {
		const steps = value / range.step;
		if (Math.abs(steps - Math.round(steps)) > 1e-9) return "notStep";
	}
	return null;
}
