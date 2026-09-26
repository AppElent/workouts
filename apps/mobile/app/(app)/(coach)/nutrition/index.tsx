import { useLocalSearchParams } from "expo-router";
import { useI18n } from "../../../../src/i18n";
import { NutritionDayScreen } from "../../../../src/screens/nutrition-day";
import { RouteError } from "../../../../src/ui/route-error";

export default function NutritionRoute() {
	const { date, select } = useLocalSearchParams<{
		date?: string;
		select?: string;
	}>();
	return <NutritionDayScreen initialDate={date} startSelecting={select} />;
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
