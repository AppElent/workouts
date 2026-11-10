/**
 * Route for saving selected diary entries (or library foods) as a Combo.
 *
 * The selection travels as comma-joined ids, resolved again on arrival: ids
 * survive a navigation, objects carried through one go stale. Diary ids that no
 * longer match anything are dropped, and an empty selection closes the route.
 */
import { router, useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/dates/calendar-day";
import {
	ComboNewFromDiary,
	ComboNewFromLibrary,
} from "../../src/features/nutrition/combo/combo-new-sources";
import { useI18n } from "../../src/i18n";
import { RouteError } from "../../src/ui/route-error";

const ids = (value?: string) => (value ?? "").split(",").filter(Boolean);
const leave = () => router.back();

export default function NutritionComboNewRoute() {
	const { foodIds, date, entryIds } = useLocalSearchParams<{
		foodIds?: string;
		date?: string;
		entryIds?: string;
	}>();
	return foodIds ? (
		<ComboNewFromLibrary foodIds={ids(foodIds)} />
	) : (
		<ComboNewFromDiary
			date={date ?? todayIsoDate()}
			entryIds={ids(entryIds)}
			onDone={leave}
		/>
	);
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
