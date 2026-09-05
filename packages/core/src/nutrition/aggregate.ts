import { NUTRIENT_KEYS, type NutrientKey, type NutrientValue } from "./nutrients";

/**
 * A summed nutrient, plus everything the UI needs to say how trustworthy the
 * sum is.
 *
 * `amount` is always a real number so arithmetic stays usable, but the counts
 * around it keep the source's honesty: a total built from entries where the
 * figure was unknown is still shown, and still marked.
 */
export type NutrientTotal = {
	/** Sum of the `value` contributions. Trace contributes 0. */
	readonly amount: number;
	/** How many contributions were considered at all. */
	readonly entryCount: number;
	readonly valueCount: number;
	readonly traceCount: number;
	readonly absentCount: number;
	/**
	 * True when at least one contribution was absent — the total is a lower
	 * bound, not a complete figure. Show it, mark it.
	 */
	readonly incomplete: boolean;
	/**
	 * True when the total is not a plain number of a plain sum: something in it
	 * was a trace or was missing. Distinct from `incomplete` so a
	 * trace-qualified total is not reported as having a hole in it.
	 */
	readonly qualified: boolean;
};

const EMPTY_TOTAL: NutrientTotal = Object.freeze({
	amount: 0,
	entryCount: 0,
	valueCount: 0,
	traceCount: 0,
	absentCount: 0,
	incomplete: false,
	qualified: false,
});

/** Sum one nutrient across contributions, keeping absence and trace visible. */
export function totalNutrient(values: readonly NutrientValue[]): NutrientTotal {
	if (values.length === 0) return EMPTY_TOTAL;

	let amount = 0;
	let valueCount = 0;
	let traceCount = 0;
	let absentCount = 0;

	for (const value of values) {
		if (value.kind === "value") {
			amount += value.amount;
			valueCount += 1;
		} else if (value.kind === "trace") {
			traceCount += 1;
		} else {
			absentCount += 1;
		}
	}

	return {
		amount,
		entryCount: values.length,
		valueCount,
		traceCount,
		absentCount,
		incomplete: absentCount > 0,
		qualified: absentCount > 0 || traceCount > 0,
	};
}

/** One contribution to a day, meal or combo: a nutrient reading per key. */
export type NutrientContribution = Partial<Record<NutrientKey, NutrientValue>>;

/**
 * Sum a set of contributions across all eight nutrients.
 *
 * A key a contribution simply does not carry counts as absent — an entry that
 * never mentions fibre is an entry whose fibre is unknown, which is exactly the
 * state the spec wants preserved.
 */
export function totalNutrients(contributions: readonly NutrientContribution[]): Record<NutrientKey, NutrientTotal> {
	const totals = {} as Record<NutrientKey, NutrientTotal>;
	for (const key of NUTRIENT_KEYS) {
		totals[key] = totalNutrient(
			contributions.map((contribution) => contribution[key] ?? { kind: "absent" as const }),
		);
	}
	return totals;
}
