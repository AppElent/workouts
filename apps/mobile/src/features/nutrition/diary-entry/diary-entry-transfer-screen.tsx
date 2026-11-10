/**
 * Copy or move selected diary entries without changing their snapshots.
 *
 * A copy is a fresh, immutable diary snapshot. A move is intentionally a
 * single batch operation that keeps the entries' identities.
 */
import {
	MEAL_SLOTS,
	type MealSlot,
	type NutritionDiarySnapshot,
	roundForDisplay,
	totalNutrients,
} from "@foundry/core";
import { Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
	type DiaryEntry,
	type DiaryEntryWithMeal,
	snapshotFromDiaryEntry,
} from "../../../data/nutrition-day";
import { useNutritionDiary } from "../../../data/nutrition-diary";
import {
	formatLongDate,
	formatShortDate,
	isoDateToLocalDate,
	shiftIsoDate,
} from "../../../dates/calendar-day";
import { useReduceMotion } from "../../../feedback/reduce-motion";
import { plural, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { MonthCalendar } from "../../../ui/month-calendar";
import { Segmented } from "../../../ui/segmented";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { writeFailureMessage } from "../use-diary-write";

type TransferMode = "copy" | "move";

/**
 * Snapshots intentionally do not carry a Combo group. Copying a single part
 * must not join it to the original group's lifecycle or presentation.
 */
export function copiedEntrySnapshot(
	entry: DiaryEntry,
	date: string,
	meal: MealSlot,
): NutritionDiarySnapshot {
	const { comboGroup: _comboGroup, ...snapshot } = snapshotFromDiaryEntry(
		entry,
		date,
		meal,
	);
	return snapshot;
}

function updateTarget(entry: DiaryEntry) {
	return { kind: "serverId" as const, id: entry.id };
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
	const diary = useNutritionDiary();
	const _reduceMotion = useReduceMotion();
	const copy = {
		...t.diaryEntry.transfer,
		...t.diaryEntry.transfer[mode],
	};
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

	const submit = async () => {
		if (saving || submitLock.current || unchanged) return;
		submitLock.current = true;
		setSaving(true);
		try {
			if (mode === "copy")
				await diary.logBatch(
					destinationDate,
					destinationMeal,
					selectedEntries.map((item) =>
						copiedEntrySnapshot(item, destinationDate, destinationMeal),
					),
				);
			else
				await diary.move(
					selectedEntries.map(updateTarget),
					destinationDate,
					destinationMeal,
				);
			onClose();
		} catch (error) {
			toast.error(writeFailureMessage(error, copy.failure));
		} finally {
			submitLock.current = false;
			setSaving(false);
		}
	};

	const requestClose = () => {
		if (!saving) onClose();
	};

	const energy = totalNutrients(selectedEntries).energy;
	const title = plural(locale, selectedEntries.length, copy.title);
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
						{ value: "copy", label: copy.modeCopy },
						{ value: "move", label: copy.modeMove },
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
						<MonthCalendar
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
								slot === "snacks" ? copy.snacksShort : t.nutrition.meals[slot],
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
