import { useI18n } from "../../i18n";
import { RouteError } from "../../ui/route-error";
export function ExerciseRouteError({
	error,
	retry,
}: {
	error: Error;
	retry: () => Promise<void>;
}) {
	const { t } = useI18n();
	return (
		<RouteError
			title={t.exercisesUnavailable.title}
			body={t.exercisesUnavailable.body}
			retryLabel={t.common.retry}
			onRetry={() => void retry()}
			error={error}
		/>
	);
}
