/**
 * Route for naming and saving the selected diary entries as a Combo.
 *
 * The selection travels as a comma-joined list of entry ids and the entries
 * themselves are resolved from the day query here, for the same reason
 * `nutrition-entry.tsx` looks its entry up: ids survive a navigation, objects
 * carried through one go stale. Ids that no longer match anything are dropped
 * rather than faked, and an empty selection closes the route instead of
 * offering to save a Combo with nothing in it.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { todayIsoDate } from "../../src/data/calendar-day";
import { MEAL_SLOTS, useNutritionDay } from "../../src/data/nutrition-day";
import { useI18n } from "../../src/i18n";
import { NutritionComboBuilder } from "../../src/screens/nutrition-combos";
import { RouteError } from "../../src/ui/route-error";

export default function NutritionComboNewRoute() {
	const { date, entryIds } = useLocalSearchParams<{
		date?: string;
		entryIds?: string;
	}>();
	const day = date ?? todayIsoDate();
	const state = useNutritionDay(day);
	const wanted = new Set((entryIds ?? "").split(",").filter(Boolean));
	const entries =
		state.status === "ready"
			? MEAL_SLOTS.flatMap((slot) => state.day.entries[slot]).filter((entry) =>
					wanted.has(entry.id),
				)
			: [];
	const nothingToSave = state.status === "ready" && entries.length === 0;

	useEffect(() => {
		if (nothingToSave) router.back();
	}, [nothingToSave]);

	if (entries.length === 0) return null;

	return (
		<NutritionComboBuilder
			entries={entries}
			onClose={() => router.back()}
			onSaved={() => router.back()}
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
