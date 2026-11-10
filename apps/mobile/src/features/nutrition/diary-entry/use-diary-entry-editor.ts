import { formatServingSelection, type MealSlot } from "@foundry/core";
import { useForm, useStore } from "@tanstack/react-form";
import { z } from "zod";
import type { DiaryEntry } from "../../../data/nutrition-day";
import { servingKey } from "../../../data/nutrition-shortcuts";
import { useI18n } from "../../../i18n";
import { useAmountSelection } from "../use-amount-selection";
import { useDeleteDiaryEntry } from "../use-delete-diary-entry";
import { useDiaryWrite } from "../use-diary-write";
import { useSnapshotServings } from "../use-snapshot-servings";

export type DiaryEntryEditorProps = {
	entry: DiaryEntry;
	meal: MealSlot;
	date: string;
	onClose: () => void;
};
export function useDiaryEntryEditor({
	entry,
	meal,
	date,
	onClose,
}: DiaryEntryEditorProps) {
	const { t } = useI18n();
	const write = useDiaryWrite();
	const servings = useSnapshotServings(entry);
	const { historical } = servings;
	const selection = useAmountSelection({
		option: historical,
		quantity: entry.quantity,
		amount: entry.amount,
	});
	const { selected } = selection;
	const form = useForm({
		defaultValues: {
			nextMeal: meal,
			nextDate: date,
		},
		validators: {
			onChange: z.object({
				nextMeal: z.enum(["breakfast", "lunch", "dinner", "snacks"]),
				nextDate: z.iso.date(),
			}),
		},
	});
	const { nextMeal, nextDate } = useStore(form.store, (state) => state.values);
	const formValid = useStore(form.store, (state) => state.isValid);
	const setMeal = (value: MealSlot) => form.setFieldValue("nextMeal", value);
	const setDate = (value: string) => form.setFieldValue("nextDate", value);
	const saving = write.busy;
	const { deleteEntry, deleting } = useDeleteDiaryEntry();
	const { quantity, amount: exactAmount } = selection;
	const valid = formValid && selection.valid;
	const dirty =
		!valid || selection.changed || nextMeal !== meal || nextDate !== date;
	async function save() {
		if (saving || deleting || !valid || !dirty) return;
		const historicalSelection = servingKey(selected) === servingKey(historical);
		const saved = await write.run(
			t.nutrition.entryEditor.saveFailure,
			async (diary) => {
				await diary.update(
					{ kind: "serverId", id: entry.id },
					{
						meal: nextMeal,
						date: nextDate,
						...(historicalSelection
							? { quantity }
							: {
									selection: {
										serving: {
											en: formatServingSelection(selected, quantity, "en"),
											nl: formatServingSelection(selected, quantity, "nl"),
										},
										amount: exactAmount,
										quantity,
										personalMeasureId:
											selected.kind === "personal-measure" ? selected.id : null,
									},
								}),
					},
				);
				return true;
			},
		);
		if (saved) onClose();
	}
	async function remove() {
		if (saving || deleting) return;
		if (await deleteEntry({ entry, meal, date })) onClose();
	}
	return {
		selection,
		servings,
		nextMeal,
		setMeal,
		nextDate,
		setDate,
		valid,
		dirty,
		busy: saving || deleting,
		saving,
		save,
		remove,
	};
}
