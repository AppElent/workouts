import { useEffect } from "react";
import { MEAL_SLOTS, useNutritionDay } from "../../../data/nutrition-day";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../../../data/nutrition-operation-service";
import { usePersonalFoods } from "../../../data/personal-foods";
import { ComboNewScreen } from "./combo-new-screen";
import { comboPartFromEntry, comboPartFromFood } from "./combo-parts";

/** A new combo from the library selection: each food at its default portion. */
export function ComboNewFromLibrary({
	foodIds,
}: {
	foodIds: readonly string[];
}) {
	const library = usePersonalFoods();
	const parts = foodIds.flatMap((id) => {
		const food = library.find(id);
		return food ? [comboPartFromFood(food)] : [];
	});
	return <ComboNewScreen parts={parts} />;
}

/**
 * A new combo from selected diary entries, looked up by id on the day so a
 * stale selection is dropped rather than faked. Entries from one meal become
 * that combo, logged; across meals the combo is only saved. Nothing left to
 * save closes the sheet.
 */
export function ComboNewFromDiary({
	date,
	entryIds,
	onDone,
}: {
	date: string;
	entryIds: readonly string[];
	onDone: () => void;
}) {
	const operations = useNutritionOperations();
	const state = useNutritionDay(date);
	const wanted = new Set(entryIds);
	const entries =
		state.status === "ready"
			? MEAL_SLOTS.flatMap((slot) =>
					state.day.entries[slot]
						.filter((entry) => wanted.has(entry.id))
						.map((entry) => ({ ...entry, meal: slot })),
				)
			: [];
	const nothingToSave = state.status === "ready" && entries.length === 0;
	useEffect(() => {
		if (nothingToSave) onDone();
	}, [nothingToSave, onDone]);
	if (entries.length === 0) return null;
	return (
		<ComboNewScreen
			parts={entries.map(comboPartFromEntry)}
			onCreated={(combo) => {
				if (new Set(entries.map((entry) => entry.meal)).size > 1) return;
				const subject = operations.getSubject();
				if (!subject) throw new Error("Not signed in.");
				operations.group(
					subject,
					date,
					entries[0].meal,
					entries.map((entry) => ({ kind: "serverId", id: entry.id })),
					{ id: mintNutritionUuid(), comboId: combo.id, name: combo.name },
				);
			}}
			onSaved={onDone}
		/>
	);
}
