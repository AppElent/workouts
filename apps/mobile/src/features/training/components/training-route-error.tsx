import type { ErrorBoundaryProps } from "expo-router";
import { useI18n } from "../../../i18n";
import { RouteError } from "../../../ui/route-error";

export function TrainingRouteError({ error, retry }: ErrorBoundaryProps) {
	const { t } = useI18n();
	return (
		<RouteError
			title={t.activity.errorTitle}
			body={t.activity.errorBody}
			retryLabel={t.common.retry}
			onRetry={() => void retry()}
			error={error}
		/>
	);
}
