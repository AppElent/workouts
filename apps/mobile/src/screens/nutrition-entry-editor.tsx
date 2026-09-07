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
 * rule — there is no swipe gesture on the diary yet, so this is the sole route
 * today and stays valid once one is added later.
 */
import { useMutation } from "convex/react";
import { useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api } from "../convex/api";
import { useDeleteDiaryEntry } from "../data/delete-diary-entry";
import type { DiaryEntry } from "../data/nutrition-day";
import { MEAL_SLOTS, type MealSlot } from "../data/nutrition-day";
import { useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { convexErrorMessage } from "../ui/confirm-dialog";
import { DateStepper } from "../ui/date-stepper";
import { Segmented } from "../ui/segmented";
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
	const updateEntry = useMutation(api.nutritionDiary.update);
	const { deleteEntry, deleting } = useDeleteDiaryEntry();

	const [quantityText, setQuantityText] = useState(String(entry.quantity));
	const [nextMeal, setNextMeal] = useState<MealSlot>(meal);
	const [nextDate, setNextDate] = useState(date);
	const [saving, setSaving] = useState(false);

	const parsedQuantity = Number(quantityText.replace(",", "."));
	const quantity =
		Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 0;
	const busy = saving || deleting;

	async function save() {
		if (busy || quantity <= 0) return;
		setSaving(true);
		try {
			await updateEntry({
				id: entry.id,
				quantity,
				meal: nextMeal,
				date: nextDate,
			});
			onClose();
		} catch (error) {
			toast.error(
				convexErrorMessage(error, t.nutrition.entryEditor.saveFailure),
			);
		} finally {
			setSaving(false);
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

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<Pressable
				onPress={onClose}
				accessibilityRole="button"
				accessibilityLabel={t.common.back}
				style={styles.back}
			>
				<AppText variant="heading" style={{ color: colors.accent }}>
					‹
				</AppText>
				<AppText>{t.common.back}</AppText>
			</Pressable>

			<View style={styles.heading}>
				<Eyebrow>{t.nutrition.entryEditor.title}</Eyebrow>
				<AppText variant="title">{entry.name[locale]}</AppText>
				<AppText variant="caption">{entry.serving[locale]}</AppText>
			</View>

			<AppText variant="label">{t.nutrition.foodBrowser.quantity}</AppText>
			<TextInput
				value={quantityText}
				onChangeText={setQuantityText}
				accessibilityLabel={t.nutrition.foodBrowser.quantity}
				keyboardType="decimal-pad"
				style={styles.input}
			/>

			<AppText variant="label">{t.nutrition.entryEditor.meal}</AppText>
			<Segmented
				options={MEAL_SLOTS.map((slot) => ({
					value: slot,
					label: t.nutrition.meals[slot],
				}))}
				value={nextMeal}
				onChange={setNextMeal}
			/>

			<AppText variant="label">{t.nutrition.entryEditor.date}</AppText>
			<Card>
				<DateStepper
					date={nextDate}
					locale={locale}
					previousLabel={t.nutrition.day.previousDay}
					nextLabel={t.nutrition.day.nextDay}
					onChange={setNextDate}
				/>
			</Card>

			<PrimaryButton
				label={
					saving ? t.nutrition.entryEditor.saving : t.nutrition.entryEditor.save
				}
				onPress={save}
				loading={saving}
				disabled={busy || quantity <= 0}
			/>
			<GhostButton
				label={
					deleting
						? t.nutrition.entryEditor.deleting
						: t.nutrition.entryEditor.delete
				}
				onPress={remove}
				loading={deleting}
				disabled={busy}
				style={styles.deleteButton}
			/>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: spacing.md },
	back: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	heading: { gap: spacing.xs },
	input: {
		minHeight: 48,
		borderRadius: radius.md,
		backgroundColor: colors.surface2,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		paddingHorizontal: spacing.md,
		color: colors.text,
		fontSize: 15,
	},
	deleteButton: { borderColor: colors.danger },
});
