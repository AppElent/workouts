import type { IsoDate } from "../calendar";
import type { NutrientTotal } from "./aggregate";
import type { NutrientKey } from "./nutrients";

export type WeekAverageDay = {
	readonly date: IsoDate;
	readonly entryCount: number;
	readonly totals: Readonly<Record<NutrientKey, NutrientTotal>>;
};

export type WeekAverage = {
	readonly value: number;
	/** How many days the average is over. */
	readonly days: number;
	/** One of those days has a trace or estimated figure. */
	readonly qualified: boolean;
};

/**
 * The daily average of a nutrient over the logged, complete days up to and
 * including `throughDate` (today counts once something is logged). Days with
 * a missing figure are left out rather than averaged as a lower bound.
 */
export function weekAverage(
	days: readonly WeekAverageDay[],
	nutrient: NutrientKey,
	throughDate: IsoDate,
): WeekAverage | undefined {
	const counted = days.filter(
		(day) =>
			day.date <= throughDate &&
			day.entryCount > 0 &&
			!day.totals[nutrient].incomplete,
	);
	if (counted.length === 0) return undefined;
	return {
		value:
			counted.reduce((sum, day) => sum + day.totals[nutrient].amount, 0) /
			counted.length,
		days: counted.length,
		qualified: counted.some((day) => day.totals[nutrient].qualified),
	};
}
