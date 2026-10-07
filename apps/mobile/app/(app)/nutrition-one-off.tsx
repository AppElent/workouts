/** One-off nutrition logging; Capture Drafts live in the Diary. */
import { useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/data/calendar-day";
import { MEAL_SLOTS, type MealSlot } from "../../src/data/nutrition-day";
import { OneOffLogScreen } from "../../src/features/nutrition/one-off/one-off-log-screen";
import { useI18n } from "../../src/i18n";
import { RouteError } from "../../src/ui/route-error";

export default function NutritionOneOffRoute() {
	const { date, meal } = useLocalSearchParams<{
		date?: string;
		meal?: string;
	}>();
	const targetMeal: MealSlot = MEAL_SLOTS.includes(meal as MealSlot)
		? (meal as MealSlot)
		: "breakfast";
	return <OneOffLogScreen date={date ?? todayIsoDate()} meal={targetMeal} />;
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
