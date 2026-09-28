import { useI18n } from "../../i18n";
import { RouteError } from "../../ui/route-error";
export function ExerciseRouteError({
	error,
	retry,
}: {
	error: Error;
	retry: () => Promise<void>;
}) {
	const { locale, t } = useI18n();
	return (
		<RouteError
			title={
				locale === "nl"
					? "Oefeningen niet beschikbaar"
					: "Exercises unavailable"
			}
			body={
				locale === "nl"
					? "Probeer het opnieuw om je oefeningen te laden."
					: "Try again to load your exercises."
			}
			retryLabel={t.common.retry}
			onRetry={() => void retry()}
			error={error}
		/>
	);
}
