export { NutritionGoalsScreen as default } from "../../src/screens/nutrition-goals";

import { useI18n } from "../../src/i18n";
import { RouteError } from "../../src/ui/route-error";

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
