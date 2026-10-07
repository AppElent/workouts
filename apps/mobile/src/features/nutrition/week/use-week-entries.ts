import type { IsoDate } from "../../../data/calendar-day";
import { MEAL_SLOTS, useNutritionDay } from "../../../data/nutrition-day";
import { weekDates } from "../../../data/nutrition-weekly-review";

type ReadyDay = Extract<
	ReturnType<typeof useNutritionDay>,
	{ status: "ready" }
>;
export type WeekEntry = ReadyDay["day"]["entries"]["breakfast"][number] & {
	date: IsoDate;
	meal: (typeof MEAL_SLOTS)[number];
};

/**
 * Every diary entry of the week, read through the same day source as the
 * diary. Loaded only where the sources are shown, never for the overview.
 */
export function useWeekEntries(week: IsoDate): WeekEntry[] | undefined {
	const dates = weekDates(week);
	// Seven fixed calls: a week always has seven days, so hook order is stable.
	const states = [
		useNutritionDay(dates[0]),
		useNutritionDay(dates[1]),
		useNutritionDay(dates[2]),
		useNutritionDay(dates[3]),
		useNutritionDay(dates[4]),
		useNutritionDay(dates[5]),
		useNutritionDay(dates[6]),
	];
	if (states.some((state) => state.status !== "ready")) return undefined;
	return states.flatMap((state, index) =>
		state.status === "ready"
			? MEAL_SLOTS.flatMap((meal) =>
					state.day.entries[meal].map((entry) => ({
						...entry,
						date: dates[index],
						meal,
					})),
				)
			: [],
	);
}
