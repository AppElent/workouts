/** One-off nutrition logging; Capture Drafts live in the Diary. */
import { useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/data/calendar-day";
import { MEAL_SLOTS, type MealSlot } from "../../src/data/nutrition-day";
import { useI18n } from "../../src/i18n";
import { NutritionCookingScreen } from "../../src/screens/nutrition-cooking";
import { RouteError } from "../../src/ui/route-error";

export default function NutritionCookingRoute() {
	const { date, meal, mode } = useLocalSearchParams<{
		date?: string;
		meal?: string;
		mode?: string;
	}>();
	const targetMeal: MealSlot = MEAL_SLOTS.includes(meal as MealSlot)
		? (meal as MealSlot)
		: "breakfast";
	return (
		<NutritionCookingScreen
			date={date ?? todayIsoDate()}
			meal={targetMeal}
			initialMode={
				mode === "oneoff-log" || mode === "recipe" ? mode : undefined
			}
		/>
	);
}

export function ErrorBoundary({
	error,
	retry,
}: {
	error: Error;
	retry: () => Promise<void>;
}) {
	const { t } = useI18n();
	return (
		<RouteError
			title={t.nutrition.error.title}
			body={t.nutrition.error.body}
			retryLabel={t.common.retry}
			onRetry={() => void retry()}
			error={error}
		/>
	);
}
