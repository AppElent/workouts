/**
 * Route for logging a saved Combo onto a day.
 *
 * Pushed over the tab bar, like the other Nutrition sub-screens, so edge-back
 * and Android's hardware back both close it and leave the diary where it was.
 */
import { router, useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/data/calendar-day";
import { useI18n } from "../../src/i18n";
import { NutritionComboLibrary } from "../../src/screens/nutrition-combos";
import { RouteError } from "../../src/ui/route-error";

export default function NutritionCombosRoute() {
	const { date } = useLocalSearchParams<{ date?: string }>();
	return (
		<NutritionComboLibrary
			date={date ?? todayIsoDate()}
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
