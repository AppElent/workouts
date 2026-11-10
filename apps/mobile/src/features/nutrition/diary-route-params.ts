import {
	type IsoDate,
	isRealIsoDate,
	MEAL_SLOTS,
	type MealSlot,
	mealSlotAt,
} from "@foundry/core";
import { todayIsoDate } from "../../dates/calendar-day";

/**
 * The diary day and meal a route opens on. Deep links are user input, so an
 * unknown date means today and an unknown meal means the meal of this hour.
 */
export function diaryRouteParams(
	params: { readonly date?: string; readonly meal?: string },
	now = new Date(),
): { readonly date: IsoDate; readonly meal: MealSlot } {
	return {
		date:
			params.date && isRealIsoDate(params.date)
				? params.date
				: todayIsoDate(now),
		meal: MEAL_SLOTS.find((slot) => slot === params.meal) ?? mealSlotAt(now),
	};
}
