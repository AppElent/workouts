/**
 * Correcting a logged entry: quantity, meal, or date, plus deletion.
 *
 * Every path here writes through `nutritionDiary.update`/`remove` and never
 * touches the shipped or Personal Food the entry came from — diary entries are
 * immutable snapshots (spec #68), so a quantity change rescales the figures
 * already on the entry rather than re-deriving them. Convex's query
 * subscriptions are what make a meal or date move show up correctly on both
 * the old and new side: this screen only ever patches one entry and closes.
 *
 * Delete is a visible, non-gesture control with a verb-specific destructive
 * confirmation, per the spec's swipe-is-an-accelerator-not-the-only-route
 * rule. It remains available alongside the diary's swipe and context menu.
 */
import {
	formatServingSelection,
	getShippedFood,
	personalFoodServingOptions,
	type ServingOption,
	servingOptions,
	withPersonalMeasures,
} from "@workouts/core/nutrition";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useDeleteDiaryEntry } from "../data/delete-diary-entry";
import type { DiaryEntry } from "../data/nutrition-day";
import { MEAL_SLOTS, type MealSlot } from "../data/nutrition-day";
import { useNutritionOperations } from "../data/nutrition-operation-service";
import { servingKey } from "../data/nutrition-shortcuts";
import { usePersonalFoods } from "../data/personal-foods";
import { usePersonalMeasures } from "../data/personal-measures";
import { useI18n } from "../i18n";
import { spacing } from "../theme";
import { convexErrorMessage } from "../ui/confirm-dialog";
import { DateStepper } from "../ui/date-stepper";
import {
	FormScreen,
	FormSection,
	FormSegmentedRow,
	InlineNumberFieldRow,
	TextAction,
} from "../ui/form";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

export function NutritionEntryEditor({
	entry,
	meal,
	date,
	onClose,
}: {
	entry: DiaryEntry;
	meal: MealSlot;
	date: string;
	onClose: () => void;
}) {
	const { t, locale } = useI18n();
	const toast = useToast();
	const operations = useNutritionOperations();
	const personalFoods = usePersonalFoods();
	const personalMeasures = usePersonalMeasures();
	const { deleteEntry, deleting } = useDeleteDiaryEntry();

	const [quantityText, setQuantityText] = useState(String(entry.quantity));
	const [nextMeal, setNextMeal] = useState<MealSlot>(meal);
	const [nextDate, setNextDate] = useState(date);
	const [saving, setSaving] = useState(false);
	const saveLock = useRef(false);
	const selectionWasExplicit = useRef(false);
	const servingChoices = useMemo(() => {
		let authored: ServingOption[] = [];
		const provenance = entry.provenance;
		if (provenance?.source === "shipped") {
			const source = getShippedFood(provenance.sourceId);
			if (source?.baseUnit === entry.baseUnit)
				authored = servingOptions(source);
		}
		if (provenance?.source === "personal" || provenance?.source === "import") {
			const source = personalFoods.find(provenance.sourceId);
			if (source?.baseUnit === entry.baseUnit) {
				authored = personalFoodServingOptions(source);
			}
		}
		if (authored.length === 0) {
			authored = [
				{
					kind: "base-unit",
					amount: 1,
					unit: entry.baseUnit,
					label:
						entry.baseUnit === "g"
							? { en: "Gram (g)", nl: "Gram (g)" }
							: entry.baseUnit === "ml"
								? { en: "Millilitre (ml)", nl: "Milliliter (ml)" }
								: { en: "Serving", nl: "Portie" },
				},
			];
		}
		return withPersonalMeasures(authored, entry.baseUnit, personalMeasures);
	}, [entry.baseUnit, entry.provenance, personalFoods, personalMeasures]);
	const currentPersonalMeasure = servingChoices.find(
		(option) =>
			option.kind === "personal-measure" &&
			option.id === entry.personalMeasureId,
	);
	const personalMeasureUnchanged = Boolean(
		currentPersonalMeasure &&
			currentPersonalMeasure.amount * entry.quantity === entry.amount &&
			formatServingSelection(currentPersonalMeasure, entry.quantity, "en") ===
				entry.serving.en &&
			formatServingSelection(currentPersonalMeasure, entry.quantity, "nl") ===
				entry.serving.nl,
	);
	const [selectedServing, setSelectedServing] = useState<
		ServingOption | undefined
	>(() => (personalMeasureUnchanged ? currentPersonalMeasure : undefined));
	useEffect(() => {
		setSelectedServing((current) => {
			if (!selectionWasExplicit.current) {
				return personalMeasureUnchanged ? currentPersonalMeasure : undefined;
			}
			if (!current) return undefined;
			const key = servingKey(current);
			return servingChoices.find((option) => servingKey(option) === key);
		});
	}, [currentPersonalMeasure, personalMeasureUnchanged, servingChoices]);
	const showHistoricalServing = !personalMeasureUnchanged;
	const historicalStatus =
		entry.personalMeasureId && !currentPersonalMeasure
			? t.nutrition.entryEditor.noLongerAvailable
			: t.nutrition.entryEditor.previousValue;

	const parsedQuantity = Number(quantityText.replace(",", "."));
	const quantity =
		Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 0;
	const busy = saving || deleting;

	async function save() {
		if (busy || saveLock.current || quantity <= 0) return;
		saveLock.current = true;
		setSaving(true);
		try {
			const subject = operations.getSubject();
			if (!subject) throw new Error("Not signed in.");
			const selection = selectedServing
				? {
						serving: {
							en: formatServingSelection(selectedServing, quantity, "en"),
							nl: formatServingSelection(selectedServing, quantity, "nl"),
						},
						quantity,
						amount: selectedServing.amount * quantity,
						personalMeasureId:
							selectedServing.kind === "personal-measure"
								? selectedServing.id
								: null,
					}
				: undefined;
			operations.update(
				subject,
				{ kind: "serverId", id: entry.id },
				{
					...(selection ? { selection } : { quantity }),
					meal: nextMeal,
					date: nextDate,
				},
				{
					targetEntry: {
						_id: entry.id,
						date,
						meal,
						name: entry.name,
						serving: entry.serving,
						quantity: entry.quantity,
						amount: entry.amount,
						baseUnit: entry.baseUnit,
						...(entry.personalMeasureId
							? { personalMeasureId: entry.personalMeasureId }
							: {}),
						nutrients: entry.nutrients,
						provenance: entry.provenance,
						...(entry.estimated ? { estimated: true as const } : {}),
						...(entry.comboGroup ? { comboGroup: entry.comboGroup } : {}),
					},
				},
				(error) => {
					saveLock.current = false;
					setSaving(false);
					toast.error(
						convexErrorMessage(error, t.nutrition.entryEditor.saveFailure),
					);
				},
				() => {
					setSaving(false);
					onClose();
				},
			);
		} catch (error) {
			saveLock.current = false;
			setSaving(false);
			toast.error(
				convexErrorMessage(error, t.nutrition.entryEditor.saveFailure),
			);
		}
	}

	async function remove() {
		if (busy) return;
		// One confirmation, shared with the diary row's swipe and long-press
		// routes, so none of the three can drift into deleting silently.
		if (await deleteEntry({ entry, meal: nextMeal, date: nextDate })) {
			onClose();
		}
	}

	const servingOptionsForPicker = [
		...(showHistoricalServing
			? [
					{
						value: "historical",
						label: `${entry.serving[locale]} · ${historicalStatus}`,
					},
				]
			: []),
		...servingChoices.map((candidate, index) => ({
			value: String(index),
			label: candidate.label[locale],
		})),
	];
	return (
		<FormScreen
			primaryAction={{
				label: saving
					? t.nutrition.entryEditor.saving
					: t.nutrition.entryEditor.save,
				onPress: save,
				loading: saving,
				disabled: busy || quantity <= 0,
			}}
		>
			<View style={{ gap: spacing.xs }}>
				<AppText variant="title">{entry.name[locale]}</AppText>
				<AppText variant="caption">{entry.serving[locale]}</AppText>
			</View>
			<FormSection title={t.nutrition.entryEditor.serving}>
				<FormSegmentedRow
					options={servingOptionsForPicker}
					value={
						selectedServing
							? String(servingChoices.indexOf(selectedServing))
							: "historical"
					}
					onChange={(value) => {
						selectionWasExplicit.current = true;
						const candidate =
							value === "historical"
								? undefined
								: servingChoices[Number(value)];
						setSelectedServing(candidate);
						setQuantityText(
							!candidate
								? String(entry.quantity)
								: candidate.kind === "base-unit" && candidate.unit !== "serving"
									? "100"
									: "1",
						);
					}}
				/>
				<InlineNumberFieldRow
					label={t.nutrition.foodBrowser.quantity}
					suffix=""
					value={quantityText}
					onChangeText={setQuantityText}
					keyboardType="decimal-pad"
				/>
			</FormSection>
			<FormSection title={t.nutrition.entryEditor.meal}>
				<FormSegmentedRow
					options={MEAL_SLOTS.map((slot) => ({
						value: slot,
						label: t.nutrition.meals[slot],
					}))}
					value={nextMeal}
					onChange={setNextMeal}
				/>
			</FormSection>
			<FormSection title={t.nutrition.entryEditor.date}>
				<DateStepper
					date={nextDate}
					locale={locale}
					previousLabel={t.nutrition.day.previousDay}
					nextLabel={t.nutrition.day.nextDay}
					onChange={setNextDate}
				/>
			</FormSection>
			<TextAction
				label={
					deleting
						? t.nutrition.entryEditor.deleting
						: t.nutrition.entryEditor.delete
				}
				onPress={remove}
				disabled={busy}
				tone="destructive"
			/>
		</FormScreen>
	);
}
