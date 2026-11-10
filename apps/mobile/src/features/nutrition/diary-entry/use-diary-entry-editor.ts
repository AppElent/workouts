import { formatServingSelection, type MealSlot } from "@foundry/core";
import { useForm, useStore } from "@tanstack/react-form";
import { useRef, useState } from "react";
import { z } from "zod";
import type { DiaryEntry } from "../../../data/nutrition-day";
import { useNutritionDiary } from "../../../data/nutrition-diary";
import { servingKey } from "../../../data/nutrition-shortcuts";
import { useI18n } from "../../../i18n";
import { useToast } from "../../../ui/toast";
import { useAmountSelection } from "../use-amount-selection";
import { useDeleteDiaryEntry } from "../use-delete-diary-entry";
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
	const toast = useToast();
	const diary = useNutritionDiary();
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
	const [saving, setSaving] = useState(false);
	const lock = useRef(false);
	const { deleteEntry, deleting } = useDeleteDiaryEntry();
	const { quantity, amount: exactAmount } = selection;
	const valid = formValid && selection.valid;
	const dirty =
		!valid || selection.changed || nextMeal !== meal || nextDate !== date;
	async function save() {
		if (lock.current || saving || deleting || !valid || !dirty) return;
		lock.current = true;
		setSaving(true);
		try {
			const historicalSelection =
				servingKey(selected) === servingKey(historical);
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
			onClose();
		} catch {
			toast.error(t.nutrition.entryEditor.saveFailure);
		} finally {
			lock.current = false;
			setSaving(false);
		}
	}
	async function remove() {
		if (lock.current || saving || deleting) return;
		lock.current = true;
		try {
			if (await deleteEntry({ entry, meal, date })) onClose();
		} finally {
			lock.current = false;
		}
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
