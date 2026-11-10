export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

import { MEAL_SLOTS, type MealSlot } from "@foundry/core";
/**
 * Route for finding and logging food into one meal on one day.
 *
 * A sibling of `(coach)`, not a screen inside it, so it is *pushed over* the
 * tab bar the way `exercises.tsx` and `session.tsx` are. That placement gives
 * what a conditional render inside the tab could not: the iOS edge-swipe back
 * gesture, an Android hardware back that closes the browser instead of leaving
 * the app, and a real navigation stack the diary sits underneath.
 *
 * `meal` is validated rather than trusted: a deep link is user input, and the
 * four slots are a closed set.
 */
import { router, useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/dates/calendar-day";
import { LogFoodScreen } from "../../src/features/nutrition/log-food/log-food-screen";

function asMealSlot(value: string | undefined): MealSlot {
	return MEAL_SLOTS.find((slot) => slot === value) ?? "breakfast";
}

export default function NutritionFoodRoute() {
	const { meal, date, draftId, query, create, comboId, replacePartId } =
		useLocalSearchParams<{
			meal?: string;
			date?: string;
			draftId?: string;
			query?: string;
			create?: string;
			comboId?: string;
			replacePartId?: string;
		}>();

	return (
		<LogFoodScreen
			meal={asMealSlot(meal)}
			date={date ?? todayIsoDate()}
			draftId={draftId || undefined}
			initialQuery={query || undefined}
			target={
				comboId
					? { comboId, replacePartId: replacePartId || undefined }
					: undefined
			}
			initialCreateKind={
				create === "personal" || create === "recipe" ? create : undefined
			}
			onClose={() => router.back()}
		/>
	);
}
