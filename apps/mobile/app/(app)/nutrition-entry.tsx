/**
 * Route for correcting one logged diary entry.
 *
 * Pushed over the tab bar for the same reasons as `nutrition-food.tsx`: edge
 * back on iOS, hardware back on Android, and a diary that is still underneath
 * rather than unmounted.
 *
 * The entry is looked up from the day query by id rather than carried through
 * the navigation as an object. That is not only what a route makes convenient —
 * it is more correct. The editor then renders whatever Convex currently holds,
 * so an entry changed or deleted from another device is reflected here instead
 * of the screen editing a stale copy it was handed on push. If it is gone, the
 * route closes itself rather than showing an editor for nothing.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { todayIsoDate } from "../../src/data/calendar-day";
import {
	MEAL_SLOTS,
	type MealSlot,
	useNutritionDay,
} from "../../src/data/nutrition-day";
import { useI18n } from "../../src/i18n";
import { NutritionEntryEditor } from "../../src/screens/nutrition-entry-editor";
import { RouteError } from "../../src/ui/route-error";

function asMealSlot(value: string | undefined): MealSlot {
	return MEAL_SLOTS.find((slot) => slot === value) ?? "breakfast";
}

export default function NutritionEntryRoute() {
	const { id, meal, date } = useLocalSearchParams<{
		id?: string;
		meal?: string;
		date?: string;
	}>();
	const day = date ?? todayIsoDate();
	const slot = asMealSlot(meal);
	const state = useNutritionDay(day);
	const entry =
		state.status === "ready"
			? state.day.entries[slot].find((candidate) => candidate.id === id)
			: undefined;
	const missing = state.status === "ready" && entry === undefined;

	// Closing during a render would fight the router; do it as an effect once
	// the day has actually loaded and the entry is genuinely not in it.
	useEffect(() => {
		if (missing) router.back();
	}, [missing]);

	if (!entry) return null;

	return (
		<NutritionEntryEditor
			entry={entry}
			meal={slot}
			date={day}
			onClose={() => router.back()}
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
