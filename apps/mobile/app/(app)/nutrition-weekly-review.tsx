import { useLocalSearchParams } from "expo-router";
import { WeekScreen } from "../../src/features/nutrition/week/week-screen";
import { useI18n } from "../../src/i18n";
import { RouteError } from "../../src/ui/route-error";

export default function NutritionWeeklyReviewRoute() {
	const { startDate } = useLocalSearchParams<{ startDate?: string }>();
	return <WeekScreen startDate={startDate} />;
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
			onRetry={() => retry()}
			error={error}
		/>
	);
}
