export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

import { MEAL_SLOTS, type MealSlot } from "@foundry/core";
/** One-off nutrition logging; Capture Drafts live in the Diary. */
import { useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/dates/calendar-day";
import { OneOffLogScreen } from "../../src/features/nutrition/one-off/one-off-log-screen";

export default function NutritionOneOffRoute() {
	const { date, meal, draftId } = useLocalSearchParams<{
		date?: string;
		meal?: string;
		draftId?: string;
	}>();
	const targetMeal: MealSlot = MEAL_SLOTS.includes(meal as MealSlot)
		? (meal as MealSlot)
		: "breakfast";
	return (
		<OneOffLogScreen
			date={date ?? todayIsoDate()}
			meal={targetMeal}
			draftId={draftId || undefined}
		/>
	);
}
