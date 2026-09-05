/**
 * Route for the Nutrition tab. See `src/screens/nutrition-day.tsx`.
 *
 * The `ErrorBoundary` export is expo-router's per-route recovery hook: when the
 * screen's render throws, the router calls this instead of tearing the whole
 * navigator down, and `retry` remounts the route. Without it a throw anywhere
 * under this tab leaves a blank screen above a tab bar that no longer works.
 */
import { useI18n } from "../../../src/i18n";
import { RouteError } from "../../../src/ui/route-error";

export { NutritionDayScreen as default } from "../../../src/screens/nutrition-day";

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
