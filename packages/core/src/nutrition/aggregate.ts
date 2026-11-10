import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "./nutrients";

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
	 * True when the total is not a plain sum of exact figures: something in it
	 * was a trace, missing, or estimated. Distinct from `incomplete` so a
	 * qualified total is not reported as having a hole in it.
	 */
	readonly qualified: boolean;
};

/** One contribution to a day, meal or combo: a nutrient reading per key. */
export type NutrientContribution = Partial<Record<NutrientKey, NutrientValue>>;

/** A Diary Entry or Combo part as a total sees it. */
export type NutrientEntry = {
	readonly nutrients: NutrientContribution;
	/** An estimated figure makes every total it is part of approximate. */
	readonly estimated?: boolean;
};

function totalNutrient(
	values: readonly NutrientValue[],
	estimatedCount: number,
): NutrientTotal {
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
		qualified: absentCount > 0 || traceCount > 0 || estimatedCount > 0,
	};
}

/**
 * Sum entries across all eight nutrients.
 *
 * A key an entry does not carry counts as absent: an entry that never
 * mentions fibre is an entry whose fibre is unknown. A known reading from an
 * estimated entry marks that nutrient's total as qualified.
 */
export function totalNutrients(
	entries: readonly NutrientEntry[],
): Record<NutrientKey, NutrientTotal> {
	const totals = {} as Record<NutrientKey, NutrientTotal>;
	for (const key of NUTRIENT_KEYS) {
		const values = entries.map(
			(entry) => entry.nutrients[key] ?? { kind: "absent" as const },
		);
		const estimated = entries.filter(
			(entry, index) => entry.estimated && values[index].kind !== "absent",
		).length;
		totals[key] = totalNutrient(values, estimated);
	}
	return totals;
}

/**
 * Several contributions as one reading per nutrient, such as a combo's parts:
 * known values add up, a sum of only traces stays a trace, and a nutrient no
 * contribution knows stays absent.
 */
export function combinedNutrients(
	contributions: readonly NutrientContribution[],
): Record<NutrientKey, NutrientValue> {
	const totals = totalNutrients(
		contributions.map((nutrients) => ({ nutrients })),
	);
	const combined = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		const total = totals[key];
		combined[key] =
			total.valueCount > 0
				? { kind: "value", amount: total.amount }
				: total.traceCount > 0
					? { kind: "trace" }
					: { kind: "absent" };
	}
	return combined;
}
