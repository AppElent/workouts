/** Edit a device-only Capture Draft's text or Meal Slot in a page sheet. */
import { useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { MEAL_SLOTS, type MealSlot } from "../data/nutrition-day";
import type { CaptureDraft } from "../data/nutrition-draft-repository";
import { useNutritionDrafts } from "../data/nutrition-drafts";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { useI18n } from "../i18n";
import { spacing } from "../theme";
import {
	FormScreen,
	FormSection,
	FormSegmentedRow,
	FormTextField,
} from "../ui/form";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

export function NutritionDraftEditor({
	draft,
	onClose,
}: {
	draft: CaptureDraft;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const copy = t.nutrition.drafts;
	const drafts = useNutritionDrafts();
	const toast = useToast();
	const reduceMotion = useReduceMotion();
	const [note, setNote] = useState(draft.note);
	const [meal, setMeal] = useState<MealSlot>(draft.meal);
	const [saving, setSaving] = useState(false);
	const unchanged = note === draft.note && meal === draft.meal;

	function save() {
		if (saving || unchanged || !note.trim()) return;
		setSaving(true);
		try {
			drafts.update(draft.id, { date: draft.date, meal, note });
			onClose();
		} catch {
			toast.error(copy.saveFailure);
			setSaving(false);
		}
	}

	return (
		<Modal
			visible
			presentationStyle="pageSheet"
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onClose}
		>
			<FormScreen
				title={copy.editTitle}
				cancelLabel={copy.cancel}
				onCancel={onClose}
				primaryAction={{
					label: copy.save,
					onPress: save,
					loading: saving,
					disabled: saving || unchanged || !note.trim(),
				}}
			>
				<View style={styles.hint}>
					<AppText variant="caption">{copy.onDevice}</AppText>
				</View>

				<FormSection>
					<FormTextField
						label={copy.noteLabel}
						value={note}
						onChangeText={setNote}
						multiline
						autoFocus
					/>
				</FormSection>

				<FormSection title={copy.mealLabel}>
					<FormSegmentedRow
						options={MEAL_SLOTS.map((slot) => ({
							value: slot,
							label: t.nutrition.meals[slot],
						}))}
						value={meal}
						onChange={setMeal}
					/>
				</FormSection>
			</FormScreen>
		</Modal>
	);
}

const styles = StyleSheet.create({
	hint: { paddingHorizontal: spacing.md },
});
