import { useI18n } from "../../src/i18n";
import { NutritionLibraryScreen } from "../../src/screens/nutrition-library";
import { RouteError } from "../../src/ui/route-error";

export default function NutritionLibraryRoute() {
	return <NutritionLibraryScreen />;
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
