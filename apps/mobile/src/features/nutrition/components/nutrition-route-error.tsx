import type { ErrorBoundaryProps } from "expo-router";
import { useI18n } from "../../../i18n";
import { RouteError } from "../../../ui/route-error";

export function NutritionRouteError({ error, retry }: ErrorBoundaryProps) {
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
