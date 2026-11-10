import {
	goalBounds,
	type IsoDate,
	type Locale,
	NUTRIENT_UNITS,
	type NutrientKey,
} from "@foundry/core";
import type { WeeklyGoal } from "../../../data/nutrition-weekly-review";
import { isoDateToLocalDate } from "../../../dates/calendar-day";
import { dateLocale, fmt } from "../../../i18n";
import type { weekReviewEn } from "../../../i18n/messages/week-review";
import { formatNutrientAmount } from "../nutrient-amount";

/** "2,300–2,700 kcal", "max. 80 g" or "min. 120 g"; undefined without a goal. */
export function weekGoalLabel(
	goals: readonly WeeklyGoal[],
	nutrient: NutrientKey,
	locale: Locale,
	copy: typeof weekReviewEn,
	withUnit = true,
): string | undefined {
	const { min, max } = goalBounds(goals, [nutrient])[0] ?? {};
	const unit = withUnit ? ` ${NUTRIENT_UNITS[nutrient]}` : "";
	if (min !== undefined && max !== undefined)
		return `${formatNutrientAmount(nutrient, min, locale)}–${formatNutrientAmount(nutrient, max, locale)}${unit}`;
	if (max !== undefined)
		return fmt(copy.max, {
			value: `${formatNutrientAmount(nutrient, max, locale)}${unit}`,
		});
	if (min !== undefined)
		return fmt(copy.min, {
			value: `${formatNutrientAmount(nutrient, min, locale)}${unit}`,
		});
	return undefined;
}

export function weekDayParts(date: IsoDate, appLocale: Locale) {
	const local = isoDateToLocalDate(date);
	const locale = dateLocale(appLocale);
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
