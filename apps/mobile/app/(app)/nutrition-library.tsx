import { LibraryScreen } from "../../src/features/nutrition/library/library-screen";
import { useI18n } from "../../src/i18n";
import { RouteError } from "../../src/ui/route-error";

export default function NutritionLibraryRoute() {
	return <LibraryScreen />;
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
