import { useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/data/calendar-day";
import { MEAL_SLOTS, type MealSlot } from "../../src/data/nutrition-day";
import { useI18n } from "../../src/i18n";
import { NutritionCopyScreen } from "../../src/screens/nutrition-copy";
import { RouteError } from "../../src/ui/route-error";

export default function NutritionCopyRoute() {
	const { targetDate, targetMeal } = useLocalSearchParams<{
		targetDate?: string;
		targetMeal?: string;
	}>();
	const meal = MEAL_SLOTS.includes(targetMeal as MealSlot)
		? (targetMeal as MealSlot)
		: "breakfast";
	return (
		<NutritionCopyScreen
			targetDate={targetDate ?? todayIsoDate()}
			targetMeal={meal}
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
			onRetry={() => {
				void retry();
			}}
			error={error}
		/>
	);
}
