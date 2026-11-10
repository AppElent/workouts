import {
	type IsoDate,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientTotal,
	shiftIsoDate,
	weekStartMonday,
} from "@foundry/core";
import { todayIsoDate } from "../dates/calendar-day";

export type WeeklyReviewDay = {
	readonly date: IsoDate;
	readonly entryCount: number;
	readonly totals: Record<NutrientKey, NutrientTotal>;
	readonly goals: readonly WeeklyGoal[];
	readonly goalBasis?: "effective" | "reference";
	readonly effectiveFrom?: string | null;
};

export type WeeklyGoal = {
	readonly nutrient: NutrientKey;
	readonly direction: "min" | "max";
	readonly target: number;
};

export function weekDates(startDate: IsoDate): readonly IsoDate[] {
	return Array.from({ length: 7 }, (_, index) =>
		shiftIsoDate(startDate, index),
	);
}

export function weekEndDate(startDate: IsoDate): IsoDate {
	return shiftIsoDate(startDate, 6);
}

export function canGoToNextWeek(
	weekStart: IsoDate,
	today: IsoDate = todayIsoDate(),
): boolean {
	return weekStart < weekStartMonday(today);
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
