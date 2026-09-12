/**
 * Copy or move one diary entry without changing the entry editor's contract.
 *
 * A copy is a fresh, immutable diary snapshot. A move is intentionally a
 * single update operation: it retains the entry's identity and lets the local
 * projection move it atomically between the two day/meal views.
 */
import type { NutritionDiarySnapshot } from "@workouts/core";
import { useRef, useState } from "react";
import {
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiaryEntry, MealSlot } from "../data/nutrition-day";
import { MEAL_SLOTS } from "../data/nutrition-day";
import {
	mintNutritionUuid,
	snapshotFromDiaryEntry,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { useI18n } from "../i18n";
import { colors, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { convexErrorMessage } from "../ui/confirm-dialog";
import { DateStepper } from "../ui/date-stepper";
import { NutritionCalendar } from "../ui/nutrition-calendar";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

type TransferMode = "copy" | "move";

type TransferCopy = {
	title: string;
	intro: string;
	destinationDate: string;
	destinationMeal: string;
	chooseDate: string;
	cancel: string;
	submit: string;
	pending: string;
	failure: string;
};

const CALENDAR_LABELS = {
	en: {
		previousMonth: "Previous month",
		nextMonth: "Next month",
		today: "Today",
		selected: "Selected",
	},
	nl: {
		previousMonth: "Vorige maand",
		nextMonth: "Volgende maand",
		today: "Vandaag",
		selected: "Geselecteerd",
	},
} as const;

function transferCopy(mode: TransferMode, locale: "en" | "nl"): TransferCopy {
	if (locale === "nl") {
		return mode === "copy"
			? {
					title: "Item kopiëren",
					intro: "Kies waar je een nieuwe kopie van dit item wilt toevoegen.",
					destinationDate: "Doeldatum",
					destinationMeal: "Doelmaaltijd",
					chooseDate: "Kies doeldatum",
					cancel: "Annuleren",
					submit: "Item kopiëren",
					pending: "Kopiëren…",
					failure:
						"Dit item kon niet worden gekopieerd. Je bestemming staat er nog.",
				}
			: {
					title: "Item verplaatsen",
					intro: "Kies waar je dit item wilt verplaatsen.",
					destinationDate: "Doeldatum",
					destinationMeal: "Doelmaaltijd",
					chooseDate: "Kies doeldatum",
					cancel: "Annuleren",
					submit: "Item verplaatsen",
					pending: "Verplaatsen…",
					failure:
						"Dit item kon niet worden verplaatst. Je bestemming staat er nog.",
				};
	}

	return mode === "copy"
		? {
				title: "Copy entry",
				intro: "Choose where to add a new copy of this entry.",
				destinationDate: "Destination date",
				destinationMeal: "Destination meal",
				chooseDate: "Choose destination date",
				cancel: "Cancel",
				submit: "Copy entry",
				pending: "Copying…",
				failure:
					"This entry could not be copied. Your destination is still here.",
			}
		: {
				title: "Move entry",
				intro: "Choose where to move this entry.",
				destinationDate: "Destination date",
				destinationMeal: "Destination meal",
				chooseDate: "Choose destination date",
				cancel: "Cancel",
				submit: "Move entry",
				pending: "Moving…",
				failure:
					"This entry could not be moved. Your destination is still here.",
			};
}

/**
 * Snapshots intentionally do not carry a Combo group. Copying a single part
 * must not join it to the original group's lifecycle or presentation.
 */
export function copiedEntrySnapshot(
	entry: DiaryEntry,
	date: string,
	meal: MealSlot,
	clientEntryId: string,
): NutritionDiarySnapshot & { clientEntryId: string } {
	const {
		comboGroup: _comboGroup,
		clientEntryId: _sourceClientEntryId,
		...snapshot
	} = snapshotFromDiaryEntry(entry, date, meal);
	return { ...snapshot, date, meal, clientEntryId };
}

function updateTarget(entry: DiaryEntry) {
	return entry.id.startsWith("client:")
		? { kind: "clientEntryId" as const, id: entry.id.slice("client:".length) }
		: { kind: "serverId" as const, id: entry.id };
}

export function NutritionEntryTransfer({
	entry,
	date,
	meal,
	mode,
	onClose,
}: {
	entry: DiaryEntry;
	date: string;
	meal: MealSlot;
	mode: TransferMode;
	onClose: () => void;
}) {
	const { locale, t } = useI18n();
	const toast = useToast();
	const operations = useNutritionOperations();
	const insets = useSafeAreaInsets();
	const reduceMotion = useReduceMotion();
	// The sheet belongs to the account that opened it. The provider normally
	// unmounts account-bound views on a switch, but this guard also prevents a
	// stale native sheet from accepting a previous person's entry.
	const [sourceSubject] = useState(() => operations.getSubject());
	const copy = transferCopy(mode, locale);
	const [destinationDate, setDestinationDate] = useState(date);
	const [destinationMeal, setDestinationMeal] = useState<MealSlot>(meal);
	const [showCalendar, setShowCalendar] = useState(false);
	const [saving, setSaving] = useState(false);
	const submitLock = useRef(false);
	const unchanged =
		mode === "move" && destinationDate === date && destinationMeal === meal;

	const releaseAfterFailure = (error: unknown) => {
		submitLock.current = false;
		setSaving(false);
		toast.error(convexErrorMessage(error, copy.failure));
	};

	const accepted = () => {
		setSaving(false);
		onClose();
	};

	const submit = () => {
		if (saving || submitLock.current || unchanged) return;
		submitLock.current = true;
		setSaving(true);
		try {
			const subject = operations.getSubject();
			if (!sourceSubject || subject !== sourceSubject)
				throw new Error("Nutrition account changed.");

			if (mode === "copy") {
				operations.create(
					subject,
					copiedEntrySnapshot(
						entry,
						destinationDate,
						destinationMeal,
						mintNutritionUuid(),
					),
					undefined,
					releaseAfterFailure,
					accepted,
				);
				return;
			}

			operations.update(
				subject,
				updateTarget(entry),
				{ date: destinationDate, meal: destinationMeal },
				{
					targetEntry: {
						_id: entry.id,
						...snapshotFromDiaryEntry(entry, date, meal),
						...(entry.comboGroup ? { comboGroup: entry.comboGroup } : {}),
					},
				},
				releaseAfterFailure,
				accepted,
			);
		} catch (error) {
			releaseAfterFailure(error);
		}
	};

	const requestClose = () => {
		if (!saving) onClose();
	};

	return (
		<Modal
			visible
			presentationStyle="pageSheet"
			allowSwipeDismissal={!saving}
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={requestClose}
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
						<Eyebrow>{copy.title}</Eyebrow>
						<AppText variant="heading">{entry.name[locale]}</AppText>
					</View>
					<Pressable
						onPress={requestClose}
						disabled={saving}
						accessibilityRole="button"
						accessibilityLabel={copy.cancel}
						accessibilityState={{ disabled: saving }}
						style={styles.cancelButton}
					>
						<AppText style={styles.cancel}>{copy.cancel}</AppText>
					</Pressable>
				</View>

				<AppText variant="caption">{copy.intro}</AppText>

				<View style={styles.section}>
					<AppText variant="label">{copy.destinationMeal}</AppText>
					<View
						accessibilityRole="radiogroup"
						accessibilityLabel={copy.destinationMeal}
						style={styles.mealOptions}
					>
						{MEAL_SLOTS.map((slot) => {
							const selected = slot === destinationMeal;
							return (
								<Pressable
									key={slot}
									onPress={() => setDestinationMeal(slot)}
									accessibilityRole="radio"
									accessibilityState={{ selected }}
									style={({ pressed }) => [
										styles.mealOption,
										selected && styles.mealOptionSelected,
										pressed && !selected && styles.mealOptionPressed,
									]}
								>
									<View
										accessible={false}
										style={[
											styles.radioMark,
											selected && styles.radioMarkSelected,
										]}
									>
										{selected ? <View style={styles.radioDot} /> : null}
									</View>
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

				<View style={styles.section}>
					<AppText variant="label">{copy.destinationDate}</AppText>
					<Card>
						<DateStepper
							date={destinationDate}
							locale={locale}
							previousLabel={t.nutrition.day.previousDay}
							nextLabel={t.nutrition.day.nextDay}
							onChange={setDestinationDate}
							onChooseDate={() => setShowCalendar((shown) => !shown)}
							chooseDateLabel={copy.chooseDate}
						/>
						{showCalendar ? (
							<NutritionCalendar
								selectedDate={destinationDate}
								locale={locale}
								labels={CALENDAR_LABELS[locale]}
								onSelect={(nextDate) => {
									setDestinationDate(nextDate);
									setShowCalendar(false);
								}}
							/>
						) : null}
					</Card>
				</View>

				<PrimaryButton
					label={saving ? copy.pending : copy.submit}
					accessibilityLabel={copy.submit}
					onPress={submit}
					loading={saving}
					disabled={saving || unchanged}
				/>
				<GhostButton
					label={copy.cancel}
					onPress={requestClose}
					disabled={saving}
				/>
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
	radioMark: {
		width: 20,
		height: 20,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 2,
		borderColor: colors.textMuted,
		borderRadius: 10,
	},
	radioMarkSelected: { borderColor: colors.accent },
	radioDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: colors.accent,
	},
});
