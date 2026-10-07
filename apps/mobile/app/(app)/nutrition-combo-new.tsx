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
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../../src/data/nutrition-operation-service";
import { usePersonalFoods } from "../../src/data/personal-foods";
import { ComboNewScreen } from "../../src/features/nutrition/combo/combo-new-screen";
import {
	comboPartFromEntry,
	comboPartFromFood,
} from "../../src/features/nutrition/combo/combo-parts";
import { useI18n } from "../../src/i18n";
import { RouteError } from "../../src/ui/route-error";

export default function NutritionComboNewRoute() {
	const { foodIds } = useLocalSearchParams<{ foodIds?: string }>();
	return foodIds ? (
		<LibraryComboRoute foodIds={foodIds} />
	) : (
		<DiaryComboRoute />
	);
}

/** From the library selection: parts at each food's default portion. */
function LibraryComboRoute({ foodIds }: { foodIds: string }) {
	const library = usePersonalFoods();
	const parts = foodIds.split(",").flatMap((id) => {
		const food = library.find(id);
		return food ? [comboPartFromFood(food)] : [];
	});
	return <ComboNewScreen parts={parts} />;
}

function DiaryComboRoute() {
	const { date, entryIds } = useLocalSearchParams<{
		date?: string;
		entryIds?: string;
	}>();
	const day = date ?? todayIsoDate();
	const operations = useNutritionOperations();
	const state = useNutritionDay(day);
	const wanted = new Set((entryIds ?? "").split(",").filter(Boolean));
	const selected =
		state.status === "ready"
			? MEAL_SLOTS.flatMap((slot) =>
					state.day.entries[slot]
						.filter((entry) => wanted.has(entry.id))
						.map((entry) => ({ entry, slot })),
				)
			: [];
	const entries = selected.map(({ entry, slot }) => ({ ...entry, meal: slot }));
	const nothingToSave = state.status === "ready" && entries.length === 0;

	useEffect(() => {
		if (nothingToSave) router.back();
	}, [nothingToSave]);

	if (entries.length === 0) return null;

	return (
		<ComboNewScreen
			parts={entries.map(comboPartFromEntry)}
			onCreated={(combo) => {
				// Entries from one meal become that combo, logged; across meals
				// the combo is only saved.
				if (new Set(entries.map((entry) => entry.meal)).size > 1) return;
				const subject = operations.getSubject();
				if (!subject) throw new Error("Not signed in.");
				operations.group(
					subject,
					day,
					entries[0].meal,
					entries.map((entry) => ({ kind: "serverId", id: entry.id })),
					{ id: mintNutritionUuid(), comboId: combo.id, name: combo.name },
				);
			}}
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
