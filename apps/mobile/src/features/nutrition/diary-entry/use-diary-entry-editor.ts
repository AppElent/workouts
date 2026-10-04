import { useForm, useStore } from "@tanstack/react-form";
import {
	formatServingSelection,
	getShippedFood,
	personalFoodServingOptions,
	type ServingOption,
	servingOptions,
	withPersonalMeasures,
	withSupplementaryServings,
} from "@workouts/core/nutrition";
import { useRef, useState } from "react";
import { z } from "zod";
import { useDeleteDiaryEntry } from "../../../data/delete-diary-entry";
import type { DiaryEntry, MealSlot } from "../../../data/nutrition-day";
import { useNutritionOperations } from "../../../data/nutrition-operation-service";
import { servingKey } from "../../../data/nutrition-shortcuts";
import { usePersonalFoods } from "../../../data/personal-foods";
import { usePersonalMeasures } from "../../../data/personal-measures";
import { useSupplementaryServings } from "../../../data/supplementary-servings";
import { useI18n } from "../../../i18n";
import { useToast } from "../../../ui/toast";

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
	const { t, locale } = useI18n();
	const quantityInput = (value: number) =>
		locale === "nl" ? String(value).replace(".", ",") : String(value);
	const toast = useToast();
	const operations = useNutritionOperations();
	const foods = usePersonalFoods();
	const measures = usePersonalMeasures();
	const source =
		entry.provenance.source === "shipped"
			? getShippedFood(entry.provenance.sourceId)
			: entry.provenance.source === "personal" ||
					entry.provenance.source === "import"
				? foods.find(entry.provenance.sourceId)
				: undefined;
	const additions = useSupplementaryServings(
		entry.provenance.source === "shipped"
			? entry.provenance.sourceId
			: undefined,
	);
	const authored =
		source && source.baseUnit === entry.baseUnit
			? "provenance" in source
				? personalFoodServingOptions(source)
				: servingOptions(source)
			: [
					{
						kind: "base-unit" as const,
						amount: 1 as const,
						unit: entry.baseUnit,
						label: {
							en:
								entry.baseUnit === "ml"
									? "Millilitre (ml)"
									: entry.baseUnit === "g"
										? "Gram (g)"
										: "Serving",
							nl:
								entry.baseUnit === "ml"
									? "Milliliter (ml)"
									: entry.baseUnit === "g"
										? "Gram (g)"
										: "Portie",
						},
					},
				];
	const choices = withPersonalMeasures(
		withSupplementaryServings(
			authored,
			entry.provenance.source === "shipped"
				? entry.provenance.sourceId
				: undefined,
			entry.baseUnit,
			additions.servings,
		),
		entry.baseUnit,
		measures,
	);
	const historical: ServingOption = {
		kind: "authored",
		index: -1,
		amount: entry.amount / entry.quantity,
		label: {
			en: entry.serving.en.replace(/ × .*$/, ""),
			nl: entry.serving.nl.replace(/ × .*$/, ""),
		},
	};
	const [selected, setSelected] = useState<ServingOption>(historical);
	const form = useForm({
		defaultValues: {
			quantityText: quantityInput(entry.quantity),
			nextMeal: meal,
			nextDate: date,
		},
		validators: {
			onChange: z.object({
				quantityText: z
					.string()
					.refine(
						(text) =>
							text.trim().length > 0 &&
							Number.isFinite(Number(text.replace(",", "."))) &&
							Number(text.replace(",", ".")) > 0,
					),
				nextMeal: z.enum(["breakfast", "lunch", "dinner", "snacks"]),
				nextDate: z.iso.date(),
			}),
		},
	});
	const { quantityText, nextMeal, nextDate } = useStore(
		form.store,
		(state) => state.values,
	);
	const formValid = useStore(form.store, (state) => state.isValid);
	const setQuantityText = (value: string) =>
		form.setFieldValue("quantityText", value);
	const setMeal = (value: MealSlot) => form.setFieldValue("nextMeal", value);
	const setDate = (value: string) => form.setFieldValue("nextDate", value);
	// Retain base amount independently: repeating decimals in a representation must not drift history.
	const [exactAmount, setExactAmount] = useState(entry.amount);
	const [saving, setSaving] = useState(false);
	const lock = useRef(false);
	const { deleteEntry, deleting } = useDeleteDiaryEntry();
	const quantity = Number(quantityText.replace(",", "."));
	const valid =
		formValid &&
		quantityText.trim().length > 0 &&
		Number.isFinite(quantity) &&
		quantity > 0 &&
		Number.isFinite(exactAmount) &&
		exactAmount > 0;
	const dirty =
		!valid ||
		exactAmount !== entry.amount ||
		servingKey(selected) !== servingKey(historical) ||
		nextMeal !== meal ||
		nextDate !== date;
	function setQuantity(text: string) {
		setQuantityText(locale === "nl" ? text.replace(".", ",") : text);
		setExactAmount(Number(text.replace(",", ".")) * selected.amount);
	}
	function select(option: ServingOption, newlyCreated = false) {
		const amount = newlyCreated ? option.amount : exactAmount;
		setSelected(option);
		setExactAmount(amount);
		setQuantityText(quantityInput(amount / option.amount));
	}
	async function save() {
		if (lock.current || saving || deleting || !valid || !dirty) return;
		lock.current = true;
		setSaving(true);
		const fail = () => {
			lock.current = false;
			setSaving(false);
			toast.error(t.nutrition.entryEditor.saveFailure);
		};
		try {
			const subject = operations.getSubject();
			if (!subject) {
				fail();
				return;
			}
			const targetEntry = {
				_id: entry.id,
				date,
				meal,
				name: entry.name,
				serving: entry.serving,
				quantity: entry.quantity,
				amount: entry.amount,
				baseUnit: entry.baseUnit,
				nutrients: entry.nutrients,
				provenance: entry.provenance,
				...(entry.personalMeasureId
					? { personalMeasureId: entry.personalMeasureId }
					: {}),
				...(entry.estimated ? { estimated: entry.estimated } : {}),
				...(entry.comboGroup ? { comboGroup: entry.comboGroup } : {}),
			};
			const historicalSelection =
				servingKey(selected) === servingKey(historical);
			operations.update(
				subject,
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
				{ targetEntry },
				fail,
				() => {
					setSaving(false);
					onClose();
				},
			);
		} catch {
			fail();
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
		source,
		additions,
		choices,
		historical,
		selected,
		select,
		quantityText,
		quantity,
		setQuantity,
		amount: exactAmount,
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
