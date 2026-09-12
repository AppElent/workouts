import { useConvexConnectionState } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { formatLongDate, shiftIsoDate } from "../data/calendar-day";
import { copyMealEntries, previousCalendarDay } from "../data/nutrition-copy";
import {
	MEAL_SLOTS,
	type MealSlot,
	useNutritionDay,
} from "../data/nutrition-day";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import { useStalledOffline } from "../data/stalled-offline";
import { fmt, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { EmptyState } from "../ui/empty-state";
import { SkeletonBlock } from "../ui/skeleton";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

function mintId(): string {
	return mintNutritionUuid();
}

export function NutritionCopyScreen({
	targetDate,
	targetMeal,
}: {
	targetDate: string;
	targetMeal: MealSlot;
}) {
	const { t, locale } = useI18n();
	const router = useRouter();
	const operations = useNutritionOperations();
	const toast = useToast();
	const [sourceDate, setSourceDate] = useState(() =>
		previousCalendarDay(targetDate),
	);
	const [sourceMeal, setSourceMeal] = useState<MealSlot>(targetMeal);
	const [destinationMeal, setDestinationMeal] = useState<MealSlot>(targetMeal);
	const [selected, setSelected] = useState<Set<string> | null>(null);
	const copyLock = useRef(false);
	const [copying, setCopying] = useState(false);
	const state = useNutritionDay(sourceDate);
	const { isWebSocketConnected } = useConvexConnectionState();
	const sourceStalled = useStalledOffline(
		state.status === "loading",
		isWebSocketConnected,
	);
	const sourceEntries =
		state.status === "ready" ? state.day.entries[sourceMeal] : [];
	const selfCopy = sourceDate === targetDate && sourceMeal === destinationMeal;
	const selectedEntries = useMemo(
		() =>
			sourceEntries.filter(
				(entry) => selected === null || selected.has(entry.id),
			),
		[sourceEntries, selected],
	);
	const sourceComplete = state.status === "ready" && state.day.complete;
	const canCopy =
		sourceComplete && !selfCopy && selectedEntries.length > 0 && !copying;

	function selectAll() {
		setSelected((current) =>
			current === null || current.size === sourceEntries.length
				? new Set()
				: new Set(sourceEntries.map((entry) => entry.id)),
		);
	}

	async function copy() {
		if (!canCopy || copyLock.current) return;
		const subject = operations.getSubject();
		if (!subject) return;
		copyLock.current = true;
		setCopying(true);
		try {
			operations.createBatch(
				subject,
				targetDate,
				destinationMeal,
				copyMealEntries(selectedEntries, targetDate, destinationMeal, mintId),
			);
			router.back();
		} catch {
			copyLock.current = false;
			setCopying(false);
			toast.error(t.nutrition.copyMeal.failure);
		}
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			style={styles.root}
			contentContainerStyle={styles.content}
		>
			<Eyebrow>{t.nutrition.title}</Eyebrow>
			<AppText variant="title">{t.nutrition.copyMeal.title}</AppText>
			<AppText variant="body">{t.nutrition.copyMeal.intro}</AppText>

			<Card style={styles.controls}>
				<AppText variant="heading">{t.nutrition.copyMeal.sourceDate}</AppText>
				<View style={styles.dateRow}>
					<GhostButton
						label={t.nutrition.day.previousDay}
						onPress={() => {
							setSourceDate((date) => shiftIsoDate(date, -1));
							setSelected(null);
						}}
					/>
					<AppText style={styles.flex}>
						{formatLongDate(sourceDate, locale)}
					</AppText>
					<GhostButton
						label={t.nutrition.day.nextDay}
						onPress={() => {
							setSourceDate((date) => shiftIsoDate(date, 1));
							setSelected(null);
						}}
					/>
				</View>
				<AppText variant="heading">{t.nutrition.copyMeal.sourceMeal}</AppText>
				<MealPicker
					value={sourceMeal}
					onChange={(meal) => {
						setSourceMeal(meal);
						setSelected(null);
					}}
					t={t}
				/>
				<AppText variant="heading">{t.nutrition.copyMeal.targetMeal}</AppText>
				<MealPicker
					value={destinationMeal}
					onChange={setDestinationMeal}
					t={t}
				/>
			</Card>

			{state.status === "loading" ? (
				sourceStalled ? (
					<EmptyState body={t.nutrition.copyMeal.uncached} />
				) : (
					<SkeletonBlock height={120} />
				)
			) : !sourceComplete ? (
				<EmptyState body={t.nutrition.copyMeal.incomplete} />
			) : sourceEntries.length === 0 ? (
				<EmptyState body={t.nutrition.copyMeal.empty} />
			) : (
				<Card>
					<View style={styles.selectionHeader}>
						<AppText>
							{fmt(t.nutrition.copyMeal.selected, {
								count: selectedEntries.length,
							})}
						</AppText>
						<GhostButton
							label={t.nutrition.copyMeal.selectAll}
							onPress={selectAll}
						/>
					</View>
					{sourceEntries.map((entry) => {
						const checked = selected === null || selected.has(entry.id);
						return (
							<Pressable
								key={entry.id}
								onPress={() =>
									setSelected((current) => {
										const next = new Set(
											current ?? sourceEntries.map((item) => item.id),
										);
										if (next.has(entry.id)) next.delete(entry.id);
										else next.add(entry.id);
										return next;
									})
								}
								accessibilityRole="checkbox"
								accessibilityState={{ checked }}
								style={styles.entry}
							>
								<AppText
									style={{ color: checked ? colors.accent : colors.textMuted }}
								>
									{checked ? "☑" : "☐"}
								</AppText>
								<View style={styles.flex}>
									<AppText>{entry.name[locale]}</AppText>
									<AppText variant="caption">{entry.serving[locale]}</AppText>
								</View>
							</Pressable>
						);
					})}
				</Card>
			)}
			{selfCopy ? (
				<AppText variant="caption">{t.nutrition.copyMeal.self}</AppText>
			) : null}
			<PrimaryButton
				label={
					copying
						? t.nutrition.copyMeal.copying
						: fmt(t.nutrition.copyMeal.copy, {
								count: selectedEntries.length,
								meal: t.nutrition.meals[destinationMeal],
							})
				}
				onPress={() => void copy()}
				disabled={!canCopy}
				loading={copying}
			/>
		</ScrollView>
	);
}

function MealPicker({
	value,
	onChange,
	t,
}: {
	value: MealSlot;
	onChange: (meal: MealSlot) => void;
	t: ReturnType<typeof useI18n>["t"];
}) {
	return (
		<View style={styles.mealPicker}>
			{MEAL_SLOTS.map((meal) => (
				<Pressable
					key={meal}
					onPress={() => onChange(meal)}
					accessibilityRole="button"
					accessibilityState={{ selected: value === meal }}
					style={[
						styles.mealChoice,
						value === meal ? styles.mealChoiceSelected : null,
					]}
				>
					<AppText>{t.nutrition.meals[meal]}</AppText>
				</Pressable>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: {
		padding: spacing.lg,
		gap: spacing.md,
		paddingBottom: spacing.xl * 2,
	},
	controls: { gap: spacing.sm },
	dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
	selectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	entry: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingVertical: spacing.sm,
	},
	mealPicker: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
	mealChoice: {
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.pill,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
	},
	mealChoiceSelected: {
		borderColor: colors.accent,
		backgroundColor: colors.surface2,
	},
	flex: { flex: 1 },
});
