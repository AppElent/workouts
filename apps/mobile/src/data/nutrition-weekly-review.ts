import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientTotal,
} from "@workouts/core/nutrition";
import {
	type IsoDate,
	isoDateToLocalDate,
	shiftIsoDate,
	toIsoDate,
} from "./calendar-day";

export type WeeklyReviewDay = {
	readonly date: IsoDate;
	readonly entries: readonly {
		readonly name?: { readonly en: string; readonly nl: string };
		readonly nutrients: Record<NutrientKey, { kind: string; amount?: number }>;
	}[];
	readonly totals: Record<NutrientKey, NutrientTotal>;
	readonly markedComplete: boolean;
};

export function weekStartMonday(date: IsoDate): IsoDate {
	const local = isoDateToLocalDate(date);
	const day = local.getDay();
	return shiftIsoDate(date, day === 0 ? -6 : 1 - day);
}

export function weekDates(startDate: IsoDate): readonly IsoDate[] {
	return Array.from({ length: 7 }, (_, index) =>
		shiftIsoDate(startDate, index),
	);
}

export function weekEndDate(startDate: IsoDate): IsoDate {
	return shiftIsoDate(startDate, 6);
}

export function isRealIsoDate(date: string): date is IsoDate {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
	const value = new Date(`${date}T12:00:00`);
	return !Number.isNaN(value.getTime()) && toIsoDate(value) === date;
}

export function reviewCoverage(days: readonly WeeklyReviewDay[]) {
	return {
		loggedDayCount: days.filter((day) => day.entries.length > 0).length,
		markedCompleteCount: days.filter((day) => day.markedComplete).length,
	};
}

export function averageKnownNutrient(
	days: readonly WeeklyReviewDay[],
	key: "energy" | "protein",
): { readonly average: number | undefined; readonly dayCount: number } {
	const knownDays = days.filter(
		(day) =>
			day.entries.length > 0 &&
			!day.totals[key].incomplete &&
			!day.totals[key].qualified,
	);
	if (knownDays.length === 0) return { average: undefined, dayCount: 0 };
	return {
		average:
			knownDays.reduce((sum, day) => sum + day.totals[key].amount, 0) /
			knownDays.length,
		dayCount: knownDays.length,
	};
}

export function emptyReviewTotals(): Record<NutrientKey, NutrientTotal> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [
			key,
			{
				amount: 0,
				entryCount: 0,
				valueCount: 0,
				traceCount: 0,
				absentCount: 0,
				incomplete: false,
				qualified: false,
			},
		]),
	) as Record<NutrientKey, NutrientTotal>;
}
