import { useConvexConnectionState } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { formatLongDate } from "../data/calendar-day";
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
import { spacing, useThemedStyles, useTokens } from "../theme";
import { Card } from "../ui/coach";
import { DateStepper } from "../ui/date-stepper";
import { EmptyState } from "../ui/empty-state";
import {
	FormScreen,
	FormSection,
	FormSegmentedRow,
	TextAction,
} from "../ui/form";
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
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
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
			if (router.canGoBack()) router.back();
			else
				router.replace({
					pathname: "/nutrition",
					params: { date: targetDate },
				});
		} catch {
			copyLock.current = false;
			setCopying(false);
			toast.error(t.nutrition.copyMeal.failure);
		}
	}

	return (
		<FormScreen
			primaryAction={{
				label: copying
					? t.nutrition.copyMeal.copying
					: fmt(
							selectedEntries.length === 1
								? t.nutrition.copyMeal.copyOne
								: t.nutrition.copyMeal.copy,
							{
								count: selectedEntries.length,
								meal: t.nutrition.meals[destinationMeal],
							},
						),
				onPress: () => void copy(),
				disabled: !canCopy,
				loading: copying,
			}}
		>
			<AppText variant="body">{t.nutrition.copyMeal.intro}</AppText>

			<FormSection title={t.nutrition.copyMeal.sourceDate}>
				<DateStepper
					date={sourceDate}
					locale={locale}
					previousLabel={t.nutrition.day.previousDay}
					nextLabel={t.nutrition.day.nextDay}
					onChange={(date) => {
						setSourceDate(date);
						setSelected(null);
					}}
				/>
			</FormSection>
			<FormSection title={t.nutrition.copyMeal.sourceMeal}>
				<FormSegmentedRow
					options={MEAL_SLOTS.map((slot) => ({
						value: slot,
						label: t.nutrition.meals[slot],
					}))}
					value={sourceMeal}
					onChange={(meal) => {
						setSourceMeal(meal);
						setSelected(null);
					}}
				/>
			</FormSection>
			<FormSection
				title={t.nutrition.copyMeal.targetMeal}
				footer={formatLongDate(targetDate, locale)}
			>
				<FormSegmentedRow
					options={MEAL_SLOTS.map((slot) => ({
						value: slot,
						label: t.nutrition.meals[slot],
					}))}
					value={destinationMeal}
					onChange={setDestinationMeal}
				/>
			</FormSection>

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
						<TextAction
							label={
								selectedEntries.length === sourceEntries.length
									? t.nutrition.copyMeal.deselectAll
									: t.nutrition.copyMeal.selectAll
							}
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
		</FormScreen>
	);
}

const createStyles = () =>
	StyleSheet.create({
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
		flex: { flex: 1 },
	});
