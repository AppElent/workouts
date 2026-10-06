/**
 * Copy or move selected diary entries without changing their snapshots.
 *
 * A copy is a fresh, immutable diary snapshot. A move is intentionally a
 * single batch operation: it retains the entries' identities and lets the local
 * projection move it atomically between the two day/meal views.
 */
import type { NutritionDiarySnapshot } from "@workouts/core";
import { roundForDisplay, totalNutrients } from "@workouts/core/nutrition";
import { Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
	formatLongDate,
	formatShortDate,
	isoDateToLocalDate,
	shiftIsoDate,
} from "../../../data/calendar-day";
import type {
	DiaryEntry,
	DiaryEntryWithMeal,
	MealSlot,
} from "../../../data/nutrition-day";
import { MEAL_SLOTS } from "../../../data/nutrition-day";
import {
	mintNutritionUuid,
	snapshotFromDiaryEntry,
	useNutritionOperations,
} from "../../../data/nutrition-operation-service";
import { useReduceMotion } from "../../../feedback/reduce-motion";
import { useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { convexErrorMessage } from "../../../ui/confirm-dialog";
import { NutritionCalendar } from "../../../ui/nutrition-calendar";
import { Segmented } from "../../../ui/segmented";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";

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

const _CALENDAR_LABELS = {
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

export function DiaryEntryTransferScreen({
	entry,
	entries,
	date,
	meal,
	mode: initialMode,
	onClose,
}: {
	entry?: DiaryEntry;
	entries?: readonly DiaryEntryWithMeal[];
	date: string;
	meal?: MealSlot;
	mode: TransferMode;
	onClose: () => void;
}) {
	const { locale, t } = useI18n();
	const colors = useTokens();
	const [mode, setMode] = useState(initialMode);
	const toast = useToast();
	const operations = useNutritionOperations();
	const _reduceMotion = useReduceMotion();
	// The sheet belongs to the account that opened it. The provider normally
	// unmounts account-bound views on a switch, but this guard also prevents a
	// stale native sheet from accepting a previous person's entry.
	const [sourceSubject] = useState(() => operations.getSubject());
	const copy = transferCopy(mode, locale);
	const selectedEntries = entries ?? (entry ? [entry] : []);
	const primary = selectedEntries[0] ?? entry;
	const sourceMeal = meal ?? entries?.[0]?.meal ?? "breakfast";
	const [destinationDate, setDestinationDate] = useState(date);
	const [destinationMeal, setDestinationMeal] = useState<MealSlot>(sourceMeal);
	const [showCalendar, setShowCalendar] = useState(false);
	const [saving, setSaving] = useState(false);
	const submitLock = useRef(false);
	if (!primary) return null;
	const unchanged =
		mode === "move" &&
		destinationDate === date &&
		(entries
			? entries.every((item) => item.meal === destinationMeal)
			: destinationMeal === sourceMeal);

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
				operations.createBatch(
					subject,
					destinationDate,
					destinationMeal,
					selectedEntries.map((item) =>
						copiedEntrySnapshot(
							item,
							destinationDate,
							destinationMeal,
							mintNutritionUuid(),
						),
					),
					releaseAfterFailure,
					accepted,
				);
				return;
			}

			operations.moveBatch(
				subject,
				selectedEntries.map(updateTarget),
				destinationDate,
				destinationMeal,
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

	const energy = totalNutrients(selectedEntries.map((e) => e.nutrients)).energy;
	const title =
		locale === "nl"
			? `${selectedEntries.length} ${selectedEntries.length === 1 ? "item" : "items"} ${mode === "copy" ? "kopiëren" : "verplaatsen"}`
			: `${mode === "copy" ? "Copy" : "Move"} ${selectedEntries.length} ${selectedEntries.length === 1 ? "item" : "items"}`;
	return (
		<>
			<Stack.Screen
				options={{
					title,
					headerTitleStyle: { color: colors.text },
					gestureEnabled: !saving,
					headerLeft: () => (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t.diaryEntry.cancel}
							onPress={requestClose}
							disabled={saving}
							style={{
								minWidth: 44,
								minHeight: 44,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<SymbolView name="xmark" size={18} tintColor={colors.text} />
						</Pressable>
					),
					unstable_headerRightItems: () => [
						{
							type: "button",
							label: copy.submit,
							accessibilityLabel: copy.submit,
							icon: { type: "sfSymbol", name: "checkmark" },
							variant: "prominent",
							tintColor: colors.accentFill,
							disabled: saving || unchanged,
							onPress: submit,
						},
					],
					headerRight: () => (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={copy.submit}
							onPress={submit}
							disabled={saving || unchanged}
							style={{
								minWidth: 44,
								minHeight: 44,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<AppText>{saving ? copy.pending : "✓"}</AppText>
						</Pressable>
					),
				}}
			/>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{
					padding: spacing.md,
					gap: spacing.md,
					paddingBottom: spacing.xxl,
				}}
			>
				<Segmented
					value={mode}
					onChange={setMode}
					options={[
						{ value: "copy", label: locale === "nl" ? "Kopiëren" : "Copy" },
						{ value: "move", label: locale === "nl" ? "Verplaatsen" : "Move" },
					]}
				/>
				<View style={{ gap: spacing.sm }}>
					<AppText variant="label">{copy.destinationDate}</AppText>
					<View style={{ flexDirection: "row", gap: spacing.xs }}>
						{[-1, 0, 1, 2].map((offset) => {
							const day = shiftIsoDate(date, offset);
							return (
								<Pressable
									key={day}
									accessibilityLabel={formatLongDate(day, locale)}
									accessibilityRole="button"
									accessibilityState={{ selected: destinationDate === day }}
									onPress={() => setDestinationDate(day)}
									style={{
										flex: 1,
										minHeight: 64,
										alignItems: "center",
										justifyContent: "center",
										borderRadius: 12,
										backgroundColor:
											destinationDate === day
												? colors.accentFill
												: colors.surface,
									}}
								>
									<AppText
										variant="caption"
										style={{
											color:
												destinationDate === day ? colors.onAccent : colors.text,
										}}
									>
										{isoDateToLocalDate(day).toLocaleDateString(locale, {
											weekday: "short",
										})}
									</AppText>
									<AppText
										style={{
											color:
												destinationDate === day ? colors.onAccent : colors.text,
										}}
									>
										{isoDateToLocalDate(day).getDate()}
									</AppText>
								</Pressable>
							);
						})}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={copy.chooseDate}
							onPress={() => setShowCalendar((v) => !v)}
							style={{
								flex: 1,
								borderRadius: 12,
								backgroundColor: colors.surface,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<SymbolView name="calendar" size={22} tintColor={colors.accent} />
						</Pressable>
					</View>

					{showCalendar ? (
						<NutritionCalendar
							selectedDate={destinationDate}
							locale={locale}
							onSelect={(next) => {
								setDestinationDate(next);
								setShowCalendar(false);
							}}
						/>
					) : null}
				</View>
				<View style={{ gap: spacing.sm }}>
					<AppText variant="label">{copy.destinationMeal}</AppText>
					<Segmented
						maxSegments={4}
						value={destinationMeal}
						onChange={setDestinationMeal}
						options={MEAL_SLOTS.map((slot) => ({
							value: slot,
							label:
								slot === "snacks" && locale === "nl"
									? "Snack"
									: t.nutrition.meals[slot],
							accessibilityLabel: t.nutrition.meals[slot],
						}))}
					/>
				</View>
				<AppText variant="footnote" style={{ textAlign: "center" }}>
					{formatShortDate(destinationDate, locale)} ·{" "}
					{t.nutrition.meals[destinationMeal]} · {mode === "copy" ? "+" : "→"}
					{energy?.incomplete ? "≥ " : ""}
					{roundForDisplay("energy", energy?.amount ?? 0)} kcal
				</AppText>
			</ScrollView>
		</>
	);
}
