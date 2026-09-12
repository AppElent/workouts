import { router, useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/data/calendar-day";
import { MEAL_SLOTS, type MealSlot } from "../../src/data/nutrition-day";
import { useI18n } from "../../src/i18n";
import { NutritionAssistanceScreen } from "../../src/screens/nutrition-assistance";
import { RouteError } from "../../src/ui/route-error";

function asMealSlot(value: string | undefined): MealSlot {
	return MEAL_SLOTS.find((slot) => slot === value) ?? "breakfast";
}

export default function NutritionAssistanceRoute() {
	const { date, meal } = useLocalSearchParams<{
		date?: string;
		meal?: string;
	}>();
	return (
		<NutritionAssistanceScreen
			date={date ?? todayIsoDate()}
			meal={asMealSlot(meal)}
			onClose={() => router.back()}
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
				retry();
			}}
			error={error}
		/>
	);
}
