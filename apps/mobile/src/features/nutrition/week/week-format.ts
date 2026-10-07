import type { NutrientKey } from "@workouts/core/nutrition";
import { type IsoDate, isoDateToLocalDate } from "../../../data/calendar-day";
import type { WeeklyGoal } from "../../../data/nutrition-weekly-review";
import { fmt } from "../../../i18n";
import type { weekReviewEn } from "../../../i18n/messages/week-review";

export function weekUnit(nutrient: NutrientKey): string {
	return nutrient === "energy" ? "kcal" : "g";
}

export function weekNumber(value: number, locale: string): string {
	return value.toLocaleString(locale, {
		maximumFractionDigits: value >= 10 ? 0 : 1,
	});
}

/** "2,300–2,700 kcal", "max. 80 g" or "min. 120 g"; undefined without a goal. */
export function weekGoalLabel(
	goals: readonly WeeklyGoal[],
	nutrient: NutrientKey,
	locale: string,
	copy: typeof weekReviewEn,
	withUnit = true,
): string | undefined {
	const min = goals.find(
		(goal) => goal.nutrient === nutrient && goal.direction === "min",
	)?.target;
	const max = goals.find(
		(goal) => goal.nutrient === nutrient && goal.direction === "max",
	)?.target;
	const unit = withUnit ? ` ${weekUnit(nutrient)}` : "";
	if (min !== undefined && max !== undefined)
		return `${weekNumber(min, locale)}–${weekNumber(max, locale)}${unit}`;
	if (max !== undefined)
		return fmt(copy.max, { value: `${weekNumber(max, locale)}${unit}` });
	if (min !== undefined)
		return fmt(copy.min, { value: `${weekNumber(min, locale)}${unit}` });
	return undefined;
}

export function weekDayParts(date: IsoDate, locale: string) {
	const local = isoDateToLocalDate(date);
	return {
		short: local
			.toLocaleDateString(locale, { weekday: "short" })
			.replace(".", "")
			.slice(0, 2)
			.toUpperCase(),
		long: local.toLocaleDateString(locale, { weekday: "long" }),
		day: local.getDate(),
		dayMonth: local.toLocaleDateString(locale, {
			day: "numeric",
			month: "short",
		}),
	};
}
