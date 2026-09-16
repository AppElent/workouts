/**
 * Edit a Capture Draft's text or meal without leaving the diary. The date is
 * not editable here: a note that belongs to another day is quicker to delete
 * and recapture than to re-file.
 */
import { useState } from "react";
import {
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MEAL_SLOTS, type MealSlot } from "../data/nutrition-day";
import type { CaptureDraft } from "../data/nutrition-draft-repository";
import { useNutritionDrafts } from "../data/nutrition-drafts";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { useI18n } from "../i18n";
import { colors, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Eyebrow } from "../ui/coach";
import { FormTextField } from "../ui/form";
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
	const insets = useSafeAreaInsets();
	const reduceMotion = useReduceMotion();
	const [note, setNote] = useState(draft.note);
	const [meal, setMeal] = useState<MealSlot>(draft.meal);
	const unchanged = note.trim() === draft.note && meal === draft.meal;

	function save() {
		if (unchanged || !note.trim()) return;
		try {
			drafts.update(draft.id, { date: draft.date, meal, note });
			onClose();
		} catch {
			toast.error(copy.saveFailure);
		}
	}

	return (
		<Modal
			visible
			presentationStyle="pageSheet"
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onClose}
		>
			<ScrollView
				style={styles.root}
				contentInsetAdjustmentBehavior="automatic"
				automaticallyAdjustKeyboardInsets
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={[
					styles.content,
					{
						paddingTop:
							Platform.OS === "ios" ? spacing.md : insets.top + spacing.sm,
						paddingBottom: insets.bottom + spacing.xl,
					},
				]}
			>
				<View style={styles.header}>
					<View style={styles.heading}>
						<Eyebrow>{copy.editTitle}</Eyebrow>
						<AppText variant="caption">{copy.onDevice}</AppText>
					</View>
					<Pressable
						onPress={onClose}
						accessibilityRole="button"
						accessibilityLabel={copy.cancel}
						style={styles.cancelButton}
					>
						<AppText style={styles.cancel}>{copy.cancel}</AppText>
					</Pressable>
				</View>

				<FormTextField
					label={copy.noteLabel}
					value={note}
					onChangeText={setNote}
					multiline
					autoFocus
				/>

				<View style={styles.section}>
					<AppText variant="label">{copy.mealLabel}</AppText>
					<View
						accessibilityRole="radiogroup"
						accessibilityLabel={copy.mealLabel}
						style={styles.mealOptions}
					>
						{MEAL_SLOTS.map((slot) => {
							const selected = slot === meal;
							return (
								<Pressable
									key={slot}
									onPress={() => setMeal(slot)}
									accessibilityRole="radio"
									accessibilityState={{ selected }}
									style={({ pressed }) => [
										styles.mealOption,
										selected && styles.mealOptionSelected,
										pressed && !selected && styles.mealOptionPressed,
									]}
								>
									<AppText
										style={selected ? styles.mealOptionTextSelected : undefined}
									>
										{t.nutrition.meals[slot]}
									</AppText>
								</Pressable>
							);
						})}
					</View>
				</View>

				<PrimaryButton
					label={copy.save}
					onPress={save}
					disabled={unchanged || !note.trim()}
				/>
				<GhostButton label={copy.cancel} onPress={onClose} />
			</ScrollView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { paddingHorizontal: spacing.md, gap: spacing.md },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.md,
		minHeight: 44,
	},
	heading: { flex: 1, gap: spacing.xs },
	cancelButton: {
		minWidth: 44,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.sm,
	},
	cancel: { color: colors.accent, fontWeight: "800" },
	section: { gap: spacing.sm },
	mealOptions: { gap: spacing.xs },
	mealOption: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: 12,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		backgroundColor: colors.surface,
	},
	mealOptionSelected: {
		borderColor: colors.accent,
		backgroundColor: colors.accentDim,
	},
	mealOptionPressed: { backgroundColor: colors.surface2 },
	mealOptionTextSelected: { fontWeight: "800" },
});
