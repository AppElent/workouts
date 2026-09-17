import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientTotal,
} from "@workouts/core/nutrition";
import {
	type IsoDate,
	isoDateToLocalDate,
	shiftIsoDate,
	todayIsoDate,
	toIsoDate,
} from "./calendar-day";

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

export type WeeklyGoalStatus =
	| "noGoal"
	| "below"
	| "met"
	| "within"
	| "exceeded"
	| "incomplete";

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

export function canGoToNextWeek(
	weekStart: IsoDate,
	today: IsoDate = todayIsoDate(),
): boolean {
	return weekStart < weekStartMonday(today);
}

export function evaluateNutrientGoal(
	amount: number,
	incomplete: boolean,
	goals: readonly Pick<WeeklyGoal, "nutrient" | "direction" | "target">[],
): {
	readonly status: WeeklyGoalStatus;
	readonly minimum?: number;
	readonly maximum?: number;
} {
	const minimum = goals.find((goal) => goal.direction === "min")?.target;
	const maximum = goals.find((goal) => goal.direction === "max")?.target;
	const bounds = {
		...(minimum === undefined ? {} : { minimum }),
		...(maximum === undefined ? {} : { maximum }),
	};
	if (incomplete) {
		return {
			status:
				maximum !== undefined && amount > maximum ? "exceeded" : "incomplete",
			...bounds,
		};
	}
	if (minimum === undefined && maximum === undefined) {
		return { status: "noGoal" };
	}
	if (minimum !== undefined && maximum !== undefined) {
		if (amount < minimum) return { status: "below", ...bounds };
		if (amount > maximum) return { status: "exceeded", ...bounds };
		return { status: "within", ...bounds };
	}
	if (minimum !== undefined) {
		return { status: amount >= minimum ? "met" : "below", ...bounds };
	}
	return {
		status: amount > (maximum as number) ? "exceeded" : "within",
		...bounds,
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
