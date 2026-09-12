/** Compact diary: date, goal summary and meals; secondary actions live in menus.
 * Diary rows retain edit/swipe actions and expose Copy/Move through both a
 * visible menu and native long press. Writes use the durable operation service.
 */

import {
	type NutrientTotal,
	roundForDisplay,
	totalNutrients,
} from "@workouts/core/nutrition";
import { useConvexConnectionState } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
	formatLongDate,
	isoDayOffset,
	todayIsoDate,
} from "../data/calendar-day";
import { useDeleteDiaryEntry } from "../data/delete-diary-entry";
import {
	type DiaryEntry,
	type GoalState,
	goalState,
	MEAL_SLOTS,
	type MealSlot,
	NUTRIENT_KEYS,
	type NutrientGoal,
	type NutrientKey,
	nutrientUnit,
	useNutritionDay,
} from "../data/nutrition-day";
import { useStalledOffline } from "../data/stalled-offline";
import { useTrainingMarker } from "../data/training-marker";
import { fmt, type Messages, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card } from "../ui/coach";
import { DateStepper } from "../ui/date-stepper";
import { EmptyState } from "../ui/empty-state";
import { NutritionCalendar } from "../ui/nutrition-calendar";
import { SkeletonBlock, SkeletonGroup } from "../ui/skeleton";
import { type RowAccessibilityProps, SwipeableRow } from "../ui/swipeable-row";
import { AppText } from "../ui/text";
import { NutritionEntryTransfer } from "./nutrition-entry-transfer";
import { NutritionMenu } from "./nutrition-menu";
import { NutritionSyncStatus } from "./nutrition-sync-status";

/** State word first, colour second — colour is never the only signal. */
const STATE_COLOR: Record<GoalState, string> = {
	neutral: colors.textMuted,
	under: colors.accent,
	met: colors.success,
	within: colors.success,
	exceeded: colors.danger,
};

export function NutritionDayScreen() {
	const { t, locale } = useI18n();
	const router = useRouter();

	// Read once per mount rather than per render: a day that changes underneath
	// the user mid-scroll because midnight passed is worse than one that is
	// right again on the next visit.
	const [today] = useState(todayIsoDate);
	const [date, setDate] = useState(today);
	const [showOther, setShowOther] = useState(false);
	const [showCalendar, setShowCalendar] = useState(false);
	const [showTools, setShowTools] = useState(false);
	const [transfer, setTransfer] = useState<{
		entry: DiaryEntry;
		meal: MealSlot;
		mode: "copy" | "move";
	} | null>(null);
	const [selecting, setSelecting] = useState(false);
	const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(
		() => new Set(),
	);

	const { deleteEntry } = useDeleteDiaryEntry();
	const state = useNutritionDay(date);
	// A day that has never been downloaded cannot arrive while the socket is
	// down, so a skeleton there is a promise the app cannot keep — but only
	// after a grace period, because the socket is briefly down on every cold
	// start and flashing "you are offline" at someone who is not would be a
	// worse lie than the skeleton.
	const { isWebSocketConnected } = useConvexConnectionState();
	const stalled = useStalledOffline(
		state.status === "loading",
		isWebSocketConnected,
	);
	const marker = useTrainingMarker(date);
	const offset = isoDayOffset(today, date);
	const totals = useMemo(() => {
		if (state.status !== "ready") return {};
		const entries = MEAL_SLOTS.flatMap((slot) => state.day.entries[slot]);
		return {
			...totalNutrients(entries.map((entry) => entry.nutrients)),
			...state.day.totals,
		};
	}, [state]);

	/**
	 * A Combo is built from entries on one day, so leaving that day ends the
	 * selection. Keeping it would let the count say "3 parts" while only the
	 * ids that happen to exist on the day you ended up on survive the
	 * resolution — silently dropping the rest, or in the worst case leaving an
	 * enabled button that resolves to nothing at all.
	 */
	function changeDate(next: string) {
		setDate(next);
		setShowCalendar(false);
		setSelecting(false);
		setSelectedEntryIds(new Set());
	}

	function openFoodBrowser(slot: MealSlot) {
		router.push({ pathname: "/nutrition-food", params: { meal: slot, date } });
	}

	const dayLabel =
		offset === 0
			? t.nutrition.day.today
			: offset === -1
				? t.nutrition.day.yesterday
				: offset === 1
					? t.nutrition.day.tomorrow
					: formatLongDate(date, locale);

	return (
		<View style={styles.root}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				automaticallyAdjustKeyboardInsets
				keyboardDismissMode="interactive"
				style={styles.scroll}
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.headerRow}>
					<View style={styles.flex}>
						<DayDateStepper
							date={date}
							locale={locale}
							t={t}
							isToday={offset === 0}
							dayLabel={dayLabel}
							onChange={changeDate}
							onToday={() => changeDate(today)}
							onChooseDate={() => setShowCalendar((open) => !open)}
						/>
					</View>
					<Pressable
						style={styles.toolbarButton}
						accessibilityRole="button"
						accessibilityLabel={
							locale === "nl" ? "Weekoverzicht" : "Weekly review"
						}
						onPress={() =>
							router.push({
								pathname: "/nutrition-weekly-review",
								params: { startDate: date },
							})
						}
					>
						<View
							accessible={false}
							style={{ flexDirection: "row", alignItems: "flex-end", gap: 3 }}
						>
							{[10, 19, 15].map((height) => (
								<View
									key={height}
									style={{
										width: 4,
										height,
										borderRadius: 2,
										backgroundColor: colors.accent,
									}}
								/>
							))}
						</View>
					</Pressable>
					<NutritionMenu
						label={
							locale === "nl" ? "Meer voedingsfuncties" : "More nutrition tools"
						}
						closeLabel={t.nutrition.entryActions.close}
						actions={[
							{
								label: t.nutrition.combos.create,
								onPress: () => setSelecting(true),
							},
							{
								label: t.nutrition.combos.log,
								onPress: () =>
									router.push({
										pathname: "/nutrition-combos",
										params: { date },
									}),
							},
							{
								label:
									locale === "nl"
										? "Recepten en onvoltooide invoer"
										: "Recipes and unfinished logs",
								onPress: () =>
									router.push({
										pathname: "/nutrition-cooking",
										params: { date, meal: "breakfast" },
									}),
							},
							{
								label:
									locale === "nl"
										? "Tekst en voedingsetiket"
										: "Text and nutrition label",
								onPress: () =>
									router.push({
										pathname: "/nutrition-assistance",
										params: { date, meal: "breakfast" },
									}),
							},
							{
								label:
									locale === "nl"
										? "Back-up van voedingsbibliotheek"
										: "Food library backup",
								onPress: () => router.push("/nutrition-library"),
							},
							{
								label: t.nutrition.goals.edit,
								onPress: () => router.push("/nutrition-goals"),
							},
							{
								label: locale === "nl" ? "Gegevensbronnen" : "Data sources",
								onPress: () => setShowTools((open) => !open),
							},
						]}
					/>
				</View>

				{marker === "visible" ? <TrainingMarker t={t} /> : null}
				{showTools ? (
					<View style={styles.attribution}>
						<AppText variant="caption">{t.nutrition.attribution.nevo}</AppText>
						<AppText variant="caption">{t.nutrition.attribution.salt}</AppText>
						<AppText variant="caption">
							{t.nutrition.attribution.incomplete}
						</AppText>
					</View>
				) : null}
				{showCalendar ? (
					<NutritionCalendar
						selectedDate={date}
						onSelect={changeDate}
						locale={locale}
						labels={
							locale === "nl"
								? {
										previousMonth: "Vorige maand",
										nextMonth: "Volgende maand",
										today: "Vandaag",
										selected: "Geselecteerd",
									}
								: undefined
						}
					/>
				) : null}

				{stalled ? (
					<OfflineDay t={t} onAdd={(slot) => openFoodBrowser(slot)} />
				) : state.status === "loading" ? (
					<DaySkeleton label={t.nutrition.day.loading} />
				) : (
					<>
						<NutritionSyncStatus />
						{state.day.goalBasis === "reference" &&
						state.day.goals.length > 0 &&
						offset !== 0 ? (
							<AppText variant="caption">
								{locale === "nl"
									? "Referentiedoelen — historische doelen zijn niet bekend."
									: "Reference goals — historical targets are not known."}
							</AppText>
						) : null}
						{state.day.goalsCached ? (
							<AppText variant="caption">
								{locale === "nl"
									? "Laatst opgeslagen doelen; mogelijk niet actueel."
									: "Last cached goals; may not be current."}
							</AppText>
						) : null}
						{!state.day.complete ? (
							<AppText variant="caption">
								{locale === "nl"
									? "Alleen lokaal beschikbare invoer. Dagtotaal is onvolledig."
									: "Only locally available entries. Day totals are incomplete."}
							</AppText>
						) : null}
						<GoalSection
							t={t}
							goals={state.day.goals}
							totals={totals}
							onSetUpGoals={() => router.push("/nutrition-goals")}
						/>

						<ComboControls
							t={t}
							selecting={selecting}
							selectedCount={selectedEntryIds.size}
							onCreate={() => setSelecting(true)}
							onLog={() =>
								router.push({
									pathname: "/nutrition-combos",
									params: { date },
								})
							}
							onCancel={() => {
								setSelecting(false);
								setSelectedEntryIds(new Set());
							}}
							onContinue={() => {
								if (selectedEntryIds.size === 0) return;
								setSelecting(false);
								router.push({
									pathname: "/nutrition-combo-new",
									params: {
										date,
										entryIds: [...selectedEntryIds].join(","),
									},
								});
								setSelectedEntryIds(new Set());
							}}
						/>

						{MEAL_SLOTS.map((slot) => (
							<MealSection
								key={slot}
								t={t}
								slot={slot}
								date={date}
								entries={state.day.entries[slot]}
								locale={locale}
								onAdd={() => openFoodBrowser(slot)}
								onCopy={() =>
									router.push({
										pathname: "/nutrition-copy",
										params: {
											targetDate: date,
											targetMeal: slot,
										},
									})
								}
								onEdit={(entry) =>
									router.push({
										pathname: "/nutrition-entry",
										params: { id: entry.id, meal: slot, date },
									})
								}
								onDelete={(entry) => deleteEntry({ entry, meal: slot, date })}
								onTransfer={(entry, mode) =>
									setTransfer({ entry, meal: slot, mode })
								}
								onCreateCombo={() => {
									setSelectedEntryIds(
										new Set(state.day.entries[slot].map((entry) => entry.id)),
									);
									setSelecting(true);
								}}
								selecting={selecting}
								selectedEntryIds={selectedEntryIds}
								onToggleEntry={(entry) =>
									setSelectedEntryIds((current) => {
										const next = new Set(current);
										if (next.has(entry.id)) next.delete(entry.id);
										else next.add(entry.id);
										return next;
									})
								}
							/>
						))}

						<OtherNutrients
							t={t}
							goals={state.day.goals}
							totals={totals}
							expanded={showOther}
							onToggle={() => setShowOther((open) => !open)}
						/>
					</>
				)}
			</ScrollView>
			{transfer ? (
				<NutritionEntryTransfer
					{...transfer}
					date={date}
					onClose={() => setTransfer(null)}
				/>
			) : null}
		</View>
	);
}

/**
 * Deliberately decorative: a glyph plus a word, never colour alone (spec
 * §"Day view and navigation", §"Native interaction and accessibility"). It
 * carries no number and reads no differently regardless of what the Activity
 * involved — there is nothing here about duration, intensity, or calories to
 * show even if the design changes later.
 */
function TrainingMarker({ t }: { t: Messages }) {
	return (
		<View
			accessible
			accessibilityLabel={t.nutrition.trainingMarker.description}
			style={styles.trainingMarker}
		>
			<AppText style={styles.trainingMarkerGlyph}>●</AppText>
			<AppText variant="caption" style={styles.trainingMarkerLabel}>
				{t.nutrition.trainingMarker.label}
			</AppText>
		</View>
	);
}

function DayDateStepper({
	date,
	dayLabel,
	locale,
	t,
	isToday,
	onChange,
	onToday,
	onChooseDate,
}: {
	date: string;
	dayLabel: string;
	locale: string;
	t: Messages;
	isToday: boolean;
	onChange: (next: string) => void;
	onToday: () => void;
	onChooseDate: () => void;
}) {
	return (
		<View style={styles.stepper}>
			<View style={{ alignSelf: "stretch" }}>
				<DateStepper
					date={date}
					displayLabel={dayLabel}
					secondaryLabel={new Date(`${date}T12:00:00`).toLocaleDateString(
						locale,
						{ month: "short", day: "numeric" },
					)}
					locale={locale}
					previousLabel={t.nutrition.day.previousDay}
					nextLabel={t.nutrition.day.nextDay}
					onChange={onChange}
					onChooseDate={onChooseDate}
					chooseDateLabel={locale === "nl" ? "Kies datum" : "Choose date"}
				/>
			</View>
			{isToday ? null : (
				<Pressable
					onPress={onToday}
					accessibilityRole="button"
					hitSlop={8}
					style={styles.todayPill}
				>
					<AppText variant="caption" style={{ color: colors.onAccent }}>
						{t.nutrition.day.goToToday}
					</AppText>
				</Pressable>
			)}
		</View>
	);
}

function GoalSection({
	t,
	goals,
	totals,
	onSetUpGoals,
}: {
	t: Messages;
	goals: NutrientGoal[];
	totals: Partial<Record<NutrientKey, NutrientTotal>>;
	onSetUpGoals: () => void;
}) {
	const macros = ["protein", "carbs", "fat"] as const;
	const extraGoals = goals.filter(
		(goal) =>
			!macros.includes(goal.nutrient as (typeof macros)[number]) &&
			goal.nutrient !== "energy",
	);
	const extraNutrients = new Set(extraGoals.map((goal) => goal.nutrient));
	const [expanded, setExpanded] = useState(false);

	return (
		<View style={styles.section}>
			<DailySummary
				t={t}
				goals={goals}
				totals={totals}
				onSetUpGoals={onSetUpGoals}
			/>
			{goals.length === 0 ? (
				<Card>
					<EmptyState
						title={t.nutrition.goals.empty.title}
						body={t.nutrition.goals.empty.body}
						action={{
							label: t.nutrition.goals.empty.action,
							onPress: onSetUpGoals,
						}}
					/>
				</Card>
			) : null}
			{goals.length > 0 && extraNutrients.size > 0 ? (
				<View style={styles.goalCard}>
					<Pressable
						onPress={() => setExpanded((open) => !open)}
						accessibilityRole="button"
						accessibilityState={{ expanded }}
						accessibilityLabel={
							expanded
								? t.nutrition.day.hideAdditionalGoals
								: t.nutrition.day.showAdditionalGoals
						}
						style={styles.disclosure}
					>
						<AppText style={styles.flex}>
							{fmt(t.nutrition.day.additionalGoals, {
								count: extraNutrients.size,
							})}
						</AppText>
						<AppText variant="heading" style={{ color: colors.accent }}>
							{expanded ? "⌃" : "⌄"}
						</AppText>
					</Pressable>
					{expanded
						? extraGoals.map((goal) => (
								<GoalRow
									key={`${goal.nutrient}-${goal.direction}`}
									t={t}
									goal={goal}
									total={totals[goal.nutrient]}
								/>
							))
						: null}
				</View>
			) : null}
		</View>
	);
}

function goalsByNutrient(goals: NutrientGoal[]) {
	const grouped = new Map<NutrientKey, NutrientGoal[]>();
	for (const goal of goals) {
		const current = grouped.get(goal.nutrient) ?? [];
		current.push(goal);
		grouped.set(goal.nutrient, current);
	}
	return grouped;
}

function totalLabel(
	t: Messages,
	key: NutrientKey,
	total: NutrientTotal | undefined,
): string {
	if (!total || total.entryCount === 0) return "0";
	if (
		total.absentCount > 0 &&
		total.valueCount === 0 &&
		total.traceCount === 0
	) {
		return t.nutrition.foodBrowser.absent;
	}
	const amount = roundForDisplay(key, total.amount);
	if (total.incomplete) return `≥ ${amount}`;
	if (total.qualified) return `~ ${amount}`;
	return String(amount);
}

function DailySummary({
	t,
	goals,
	totals,
	onSetUpGoals,
}: {
	t: Messages;
	goals: NutrientGoal[];
	totals: Partial<Record<NutrientKey, NutrientTotal>>;
	onSetUpGoals: () => void;
}) {
	const groups = goalsByNutrient(goals);
	const energy = totals.energy;
	const energyGoals = groups.get("energy") ?? [];
	const min = energyGoals.find((goal) => goal.direction === "min")?.target;
	const max = energyGoals.find((goal) => goal.direction === "max")?.target;
	const energyDisplay = describeEnergy(t, energy, min, max);

	return (
		<Card style={styles.summaryCard}>
			<View style={styles.summaryHeader}>
				<AppText variant="caption">{t.nutrition.goals.heading}</AppText>
				<Pressable
					onPress={onSetUpGoals}
					accessibilityRole="button"
					style={styles.editGoals}
				>
					<AppText variant="caption" style={{ color: colors.accent }}>
						{t.nutrition.goals.edit}
					</AppText>
				</Pressable>
			</View>
			<View
				style={styles.summaryEnergy}
				accessible
				accessibilityLabel={energyDisplay.accessibility}
			>
				<AppText variant="title">{energyDisplay.primary}</AppText>
				<AppText variant="caption">{energyDisplay.secondary}</AppText>
			</View>
			{(max ?? min ?? 0) > 0 && goalStatusAvailable(energyGoals, energy) ? (
				<View style={styles.track}>
					<View
						style={[
							styles.fill,
							{
								width: `${Math.max(0, Math.min(100, ((energy?.amount ?? 0) / (max ?? min ?? 1)) * 100))}%`,
								backgroundColor: colors.accent,
							},
						]}
					/>
				</View>
			) : null}
			<View style={styles.macros}>
				{["protein", "carbs", "fat"].map((key) => (
					<MacroRow
						key={key}
						t={t}
						nutrient={key as NutrientKey}
						total={totals[key as NutrientKey]}
						goals={groups.get(key as NutrientKey) ?? []}
					/>
				))}
			</View>
		</Card>
	);
}

function describeEnergy(
	t: Messages,
	total: NutrientTotal | undefined,
	min: number | undefined,
	max: number | undefined,
) {
	const amount = total?.amount ?? 0;
	const logged = roundForDisplay("energy", amount);
	const invalidRange = min !== undefined && max !== undefined && min > max;
	const reference = invalidRange
		? t.nutrition.day.reviewGoals
		: min !== undefined && max !== undefined
			? fmt(t.nutrition.day.energyRangeReference, { logged, min, max })
			: max !== undefined
				? fmt(t.nutrition.day.energyReference, { logged, target: max })
				: min !== undefined
					? fmt(t.nutrition.day.energyReference, { logged, target: min })
					: t.nutrition.day.energyNoGoal;
	if (!total || total.entryCount === 0) {
		const primary = fmt(t.nutrition.day.energyLogged, { amount: logged });
		return {
			primary,
			secondary: reference,
			accessibility: `${primary}. ${reference}`,
		};
	}
	if (total?.absentCount && total.valueCount === 0 && total.traceCount === 0) {
		return {
			primary: t.nutrition.day.unavailableEnergy,
			secondary: reference,
			accessibility: `${t.nutrition.day.unavailableEnergy}. ${reference}`,
		};
	}
	if (total?.incomplete) {
		const primary = fmt(t.nutrition.day.knownEnergy, { amount: logged });
		return {
			primary,
			secondary: reference,
			accessibility: `${primary}. ${reference}`,
		};
	}
	if (total?.qualified) {
		const primary = fmt(t.nutrition.day.approximateEnergy, { amount: logged });
		return {
			primary,
			secondary: reference,
			accessibility: `${primary}. ${reference}`,
		};
	}
	if (invalidRange) {
		const primary = fmt(t.nutrition.day.energyLogged, { amount: logged });
		return {
			primary,
			secondary: reference,
			accessibility: `${primary}. ${reference}`,
		};
	}
	if (min !== undefined && max !== undefined) {
		const primary =
			amount < min
				? fmt(t.nutrition.day.energyToRange, {
						amount: roundForDisplay("energy", min - amount),
					})
				: amount > max
					? fmt(t.nutrition.day.energyAboveRange, {
							amount: roundForDisplay("energy", amount - max),
						})
					: t.nutrition.day.energyWithinRange;
		return {
			primary,
			secondary: reference,
			accessibility: `${primary}. ${reference}`,
		};
	}
	if (max !== undefined) {
		const primary =
			amount < max
				? fmt(t.nutrition.day.energyRemaining, {
						amount: roundForDisplay("energy", max - amount),
					})
				: amount === max
					? t.nutrition.day.energyTargetReached
					: fmt(t.nutrition.day.energyAboveTarget, {
							amount: roundForDisplay("energy", amount - max),
						});
		return {
			primary,
			secondary: reference,
			accessibility: `${primary}. ${reference}`,
		};
	}
	if (min !== undefined) {
		const primary =
			amount < min
				? fmt(t.nutrition.day.energyToMinimum, {
						amount: roundForDisplay("energy", min - amount),
					})
				: t.nutrition.day.energyMinimumReached;
		return {
			primary,
			secondary: reference,
			accessibility: `${primary}. ${reference}`,
		};
	}
	const primary = fmt(t.nutrition.day.energyLogged, { amount: logged });
	return {
		primary,
		secondary: reference,
		accessibility: `${primary}. ${reference}`,
	};
}

function MacroRow({
	t,
	nutrient,
	total,
	goals,
}: {
	t: Messages;
	nutrient: NutrientKey;
	total: NutrientTotal | undefined;
	goals: NutrientGoal[];
}) {
	const value = totalLabel(t, nutrient, total);
	const displayValue =
		value === t.nutrition.foodBrowser.absent ||
		value === t.nutrition.foodBrowser.trace
			? value
			: `${value} g`;
	const canReportStatus = goalStatusAvailable(goals, total);
	const goalStatus = canReportStatus
		? goals
				.map(
					(goal) =>
						t.nutrition.goals.state[
							goalState(goal.direction, total?.amount, goal.target)
						],
				)
				.join(". ")
		: "";
	return (
		<View
			style={styles.macroRow}
			accessible
			accessibilityLabel={`${t.nutrition.nutrients[nutrient]}: ${displayValue}${goalStatus ? `. ${goalStatus}.` : ""}`}
		>
			<AppText variant="caption">{t.nutrition.nutrients[nutrient]}</AppText>
			<View style={styles.macroValue}>
				<AppText style={styles.strong}>{displayValue}</AppText>
				{goals.map((goal) => (
					<View key={`${goal.nutrient}-${goal.direction}`}>
						<AppText variant="caption">
							{goal.direction === "min" ? "≥" : "≤"} {goal.target} g
						</AppText>
						{canReportStatus ? (
							<AppText variant="caption">
								{
									t.nutrition.goals.state[
										goalState(goal.direction, total?.amount, goal.target)
									]
								}
							</AppText>
						) : null}
					</View>
				))}
			</View>
		</View>
	);
}

function goalStatusAvailable(
	goals: NutrientGoal[],
	total: NutrientTotal | undefined,
) {
	if (
		total === undefined ||
		total.entryCount === 0 ||
		total.absentCount > 0 ||
		total.incomplete ||
		total.qualified
	) {
		return false;
	}
	const min = goals.find((goal) => goal.direction === "min")?.target;
	const max = goals.find((goal) => goal.direction === "max")?.target;
	return !(min !== undefined && max !== undefined && min > max);
}

function GoalRow({
	t,
	goal,
	total,
}: {
	t: Messages;
	goal: NutrientGoal;
	total: NutrientTotal | undefined;
}) {
	const amount = total?.amount;
	const canReportStatus = goalStatusAvailable([goal], total);
	const state = goalState(goal.direction, amount, goal.target);
	const unit = t.nutrition.units[nutrientUnit(goal.nutrient)];
	const name = t.nutrition.nutrients[goal.nutrient];
	const progress = fmt(t.nutrition.goals.progress, {
		total: qualifiedAmount(goal.nutrient, total),
		target: goal.target,
		unit,
	});
	const stateWord = t.nutrition.goals.state[state];
	const fraction = Math.max(0, Math.min(1, (amount ?? 0) / goal.target));

	return (
		<View
			accessible
			accessibilityLabel={`${name}: ${progress}${canReportStatus ? `. ${stateWord}.` : ""}`}
			style={styles.goalRow}
		>
			<View style={styles.goalHeader}>
				<AppText style={styles.goalName}>{name}</AppText>
				<AppText variant="caption">{progress}</AppText>
			</View>
			<View style={styles.track}>
				<View
					style={[
						styles.fill,
						{
							width: `${fraction * 100}%`,
							backgroundColor: STATE_COLOR[state],
						},
					]}
				/>
			</View>
			{canReportStatus ? (
				<AppText variant="caption" style={{ color: STATE_COLOR[state] }}>
					{stateWord}
				</AppText>
			) : null}
		</View>
	);
}

function ComboControls({
	t,
	selecting,
	selectedCount,
	onCancel,
	onContinue,
}: {
	t: Messages;
	selecting: boolean;
	selectedCount: number;
	onCreate: () => void;
	onLog: () => void;
	onCancel: () => void;
	onContinue: () => void;
}) {
	if (selecting) {
		return (
			<Card style={styles.comboControls}>
				<AppText>{t.nutrition.combos.selectionHelp}</AppText>
				<View style={styles.comboActions}>
					<GhostButton label={t.nutrition.combos.cancel} onPress={onCancel} />
					<PrimaryButton
						label={
							selectedCount === 1
								? t.nutrition.combos.continueOne
								: fmt(t.nutrition.combos.continueMany, {
										count: selectedCount,
									})
						}
						onPress={onContinue}
						disabled={selectedCount === 0}
					/>
				</View>
			</Card>
		);
	}

	return null;
}

function MealSection({
	date,
	t,
	slot,
	entries,
	locale,
	onAdd,
	onCopy,
	onTransfer,
	onCreateCombo,
	onEdit,
	onDelete,
	selecting,
	selectedEntryIds,
	onToggleEntry,
}: {
	t: Messages;
	slot: MealSlot;
	date: string;
	entries: DiaryEntry[];
	locale: "en" | "nl";
	onAdd: () => void;
	onCopy: () => void;
	onTransfer: (entry: DiaryEntry, mode: "copy" | "move") => void;
	onCreateCombo: () => void;
	onEdit: (entry: DiaryEntry) => void;
	onDelete: (entry: DiaryEntry) => void;
	selecting: boolean;
	selectedEntryIds: ReadonlySet<string>;
	onToggleEntry: (entry: DiaryEntry) => void;
}) {
	const mealName = t.nutrition.meals[slot];
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
		() => new Set(),
	);
	const consumedGroups = new Set<string>();
	const subtotals = useMemo(
		() => totalNutrients(entries.map((entry) => entry.nutrients)),
		[entries],
	);

	return (
		<View style={styles.section}>
			<View style={styles.mealHeader}>
				<View style={styles.flex}>
					<AppText variant="heading">{mealName}</AppText>
					{entries.length > 0 ? (
						<AppText variant="caption">
							{totalLabel(t, "energy", subtotals.energy)}{" "}
							{t.nutrition.units.kcal}
						</AppText>
					) : null}
				</View>
				<View style={styles.mealActions}>
					<NutritionMenu
						label={`${mealName}: ${locale === "nl" ? "acties" : "actions"}`}
						closeLabel={t.nutrition.entryActions.close}
						actions={[
							{ label: t.nutrition.day.copyMeal, onPress: onCopy },
							...(entries.length
								? [{ label: t.nutrition.combos.create, onPress: onCreateCombo }]
								: []),
						]}
					/>
					<Pressable
						onPress={onAdd}
						accessibilityRole="button"
						// Icon-only, so the whole meaning of the control is this label.
						accessibilityLabel={fmt(t.nutrition.addTo, { meal: mealName })}
						style={({ pressed }) => [
							styles.addButton,
							pressed ? { backgroundColor: colors.accentPressed } : null,
						]}
					>
						<AppText variant="heading" style={{ color: colors.onAccent }}>
							+
						</AppText>
					</Pressable>
				</View>
			</View>
			<Card>
				{entries.length === 0 ? (
					<EmptyState body={t.nutrition.mealEmpty} />
				) : (
					entries.map((entry) => {
						const group = entry.comboGroup;
						if (!group) {
							return (
								<EntryRow
									key={entry.id}
									t={t}
									entry={entry}
									meal={slot}
									date={date}
									locale={locale}
									selecting={selecting}
									selected={selectedEntryIds.has(entry.id)}
									onPress={() =>
										selecting ? onToggleEntry(entry) : onEdit(entry)
									}
									onDelete={() => onDelete(entry)}
									onTransfer={(mode) => onTransfer(entry, mode)}
								/>
							);
						}
						if (consumedGroups.has(group.id)) return null;
						consumedGroups.add(group.id);
						const parts = entries.filter(
							(candidate) => candidate.comboGroup?.id === group.id,
						);
						const expanded = selecting || expandedGroups.has(group.id);
						return (
							<View key={group.id}>
								<Pressable
									disabled={selecting}
									accessible={!selecting}
									onPress={() =>
										setExpandedGroups((current) => {
											const next = new Set(current);
											if (next.has(group.id)) next.delete(group.id);
											else next.add(group.id);
											return next;
										})
									}
									accessibilityRole={selecting ? undefined : "button"}
									accessibilityState={selecting ? undefined : { expanded }}
									accessibilityLabel={
										selecting
											? undefined
											: fmt(
													expanded
														? t.nutrition.combos.collapseGroup
														: t.nutrition.combos.expandGroup,
													{ name: group.name },
												)
									}
									style={styles.entryRow}
								>
									<View style={styles.flex}>
										<AppText style={styles.goalName}>{group.name}</AppText>
										<AppText variant="caption">
											{parts.length === 1
												? t.nutrition.combos.partsOne
												: fmt(t.nutrition.combos.partsMany, {
														count: parts.length,
													})}
										</AppText>
									</View>
									<AppText style={styles.entryEnergy}>
										{totalLabel(
											t,
											"energy",
											totalNutrients(parts.map((part) => part.nutrients))
												.energy,
										)}{" "}
										{t.nutrition.units.kcal}
									</AppText>
									<AppText variant="heading">{expanded ? "⌃" : "⌄"}</AppText>
								</Pressable>
								{expanded
									? parts.map((part) => (
											<EntryRow
												key={part.id}
												t={t}
												entry={part}
												meal={slot}
												date={date}
												locale={locale}
												selecting={selecting}
												selected={selectedEntryIds.has(part.id)}
												inGroup
												onPress={() =>
													selecting ? onToggleEntry(part) : onEdit(part)
												}
												onDelete={() => onDelete(part)}
												onTransfer={(mode) => onTransfer(part, mode)}
											/>
										))
									: null}
							</View>
						);
					})
				)}
			</Card>
		</View>
	);
}

/**
 * One logged entry.
 *
 * Tapping opens the editor — the visible, always-present route to every
 * correction including deletion. Swipe and long press are accelerators layered
 * on top by `SwipeableRow`, and delete through either of them still goes
 * through the same confirmation the editor's own Delete does; there is no path
 * from a gesture to a removed entry without an explicit yes.
 *
 * While a Combo selection is in progress the row is a checkbox instead, and
 * the accelerators come off: a swipe that edited an entry mid-selection would
 * be acting on something the user is in the middle of choosing.
 */
function EntryRow({
	meal,
	date,
	t,
	entry,
	locale,
	selecting,
	selected,
	inGroup = false,
	onPress,
	onDelete,
	onTransfer,
}: {
	t: Messages;
	entry: DiaryEntry;
	meal: MealSlot;
	date: string;
	locale: "en" | "nl";
	selecting: boolean;
	selected: boolean;
	/** Indents the row under its Combo header. Only a part is ever nested. */
	inGroup?: boolean;
	onPress: () => void;
	onDelete: () => void;
	onTransfer: (mode: "copy" | "move") => void;
}) {
	const content = (accessibility?: RowAccessibilityProps) => (
		<Pressable
			onPress={onPress}
			accessibilityRole={selecting ? "checkbox" : "button"}
			accessibilityState={selecting ? { checked: selected } : undefined}
			accessibilityLabel={
				selecting
					? fmt(t.nutrition.combos.selectEntry, {
							name: entry.name[locale],
						})
					: fmt(t.nutrition.entryEditor.editEntry, {
							name: entry.name[locale],
						})
			}
			{...accessibility}
			style={({ pressed }) => [
				pressed ? { backgroundColor: colors.surface2 } : null,
			]}
		>
			<View style={[styles.entryRow, inGroup ? styles.comboPart : null]}>
				{selecting ? (
					<AppText
						style={{ color: selected ? colors.accent : colors.textMuted }}
					>
						{selected ? "☑" : "☐"}
					</AppText>
				) : null}
				<View style={styles.flex}>
					<AppText style={styles.goalName}>{entry.name[locale]}</AppText>
					<AppText variant="caption">{entry.serving[locale]}</AppText>
					{entry.pendingOperationId ? (
						<AppText variant="caption">{t.nutrition.day.syncPending}</AppText>
					) : null}
				</View>
				<AppText style={styles.entryEnergy}>
					{entry.nutrients.energy.kind === "value"
						? roundForDisplay("energy", entry.nutrients.energy.amount)
						: entry.nutrients.energy.kind === "trace"
							? t.nutrition.foodBrowser.trace
							: t.nutrition.foodBrowser.absent}{" "}
					{t.nutrition.units.kcal}
				</AppText>
			</View>
		</Pressable>
	);

	if (selecting) return content();

	return (
		<SwipeableRow
			showMenuButton
			href={{
				pathname: "/nutrition-entry",
				params: { id: entry.id, meal, date },
			}}
			menuTitle={`${locale === "nl" ? "Acties voor" : "Actions for"} ${entry.name[locale]}`}
			closeMenuLabel={t.nutrition.entryActions.close}
			actions={[
				{ key: "edit", label: t.nutrition.entryActions.edit, onPress },
				{
					key: "copy",
					label: locale === "nl" ? "Kopiëren" : "Copy",
					onPress: () => onTransfer("copy"),
					swipe: false,
				},
				{
					key: "move",
					label: locale === "nl" ? "Verplaatsen" : "Move",
					onPress: () => onTransfer("move"),
					swipe: false,
				},
				{
					key: "delete",
					label: t.nutrition.entryActions.delete,
					onPress: onDelete,
					destructive: true,
				},
			]}
		>
			{content}
		</SwipeableRow>
	);
}

function OtherNutrients({
	t,
	goals,
	totals,
	expanded,
	onToggle,
}: {
	t: Messages;
	goals: NutrientGoal[];
	totals: Partial<Record<NutrientKey, NutrientTotal>>;
	expanded: boolean;
	onToggle: () => void;
}) {
	const targeted = useMemo(
		() => new Set(goals.map((goal) => goal.nutrient)),
		[goals],
	);
	const others = NUTRIENT_KEYS.filter((key) => !targeted.has(key));

	if (others.length === 0) return null;

	return (
		<View style={styles.section}>
			<Pressable
				onPress={onToggle}
				accessibilityRole="button"
				accessibilityState={{ expanded }}
				accessibilityLabel={
					expanded
						? t.nutrition.otherNutrients.hide
						: t.nutrition.otherNutrients.show
				}
				style={styles.disclosure}
			>
				<AppText variant="heading" style={styles.flex}>
					{t.nutrition.otherNutrients.heading}
				</AppText>
				<AppText variant="heading" style={{ color: colors.accent }}>
					{expanded ? "⌃" : "⌄"}
				</AppText>
			</Pressable>
			{expanded ? (
				<Card>
					{others.map((key) => (
						<View key={key} style={styles.entryRow}>
							<AppText style={styles.flex}>
								{t.nutrition.nutrients[key]}
							</AppText>
							<AppText variant="caption">
								{qualifiedAmount(key, totals[key])}{" "}
								{t.nutrition.units[nutrientUnit(key)]}
							</AppText>
						</View>
					))}
				</Card>
			) : null}
		</View>
	);
}

function qualifiedAmount(
	key: NutrientKey,
	total: NutrientTotal | undefined,
): string | number {
	if (!total) return 0;
	const amount = roundForDisplay(key, total.amount);
	if (total.incomplete) return `≥ ${amount}`;
	if (total.qualified) return `~ ${amount}`;
	return amount;
}

/**
 * What the day shows when it is offline and has nothing cached for this date.
 *
 * Not a skeleton: a skeleton promises content is arriving, and while the
 * socket is down for a day this device has never held, none is. Saying so is
 * the coherent behaviour spec #68 asks for.
 *
 * The four slots keep their plus controls, because logging offline genuinely
 * works — the shipped library is in the bundle, Personal Foods and Combos are
 * in SQLite, and Convex queues the write and replays it on reconnect. The
 * slots read "not available offline" rather than the usual empty-slot
 * sentence, because "nothing logged here" would be a claim this screen is in
 * no position to make.
 */
function OfflineDay({
	t,
	onAdd,
}: {
	t: Messages;
	onAdd: (slot: MealSlot) => void;
}) {
	return (
		<>
			<Card style={styles.goalCard}>
				<EmptyState
					title={t.nutrition.offline.title}
					body={t.nutrition.offline.body}
				/>
			</Card>
			{MEAL_SLOTS.map((slot) => {
				const mealName = t.nutrition.meals[slot];
				return (
					<View key={slot} style={styles.section}>
						<View style={styles.mealHeader}>
							<AppText variant="heading">{mealName}</AppText>
							<Pressable
								onPress={() => onAdd(slot)}
								accessibilityRole="button"
								accessibilityLabel={fmt(t.nutrition.addTo, { meal: mealName })}
								style={({ pressed }) => [
									styles.addButton,
									pressed ? { backgroundColor: colors.accentPressed } : null,
								]}
							>
								<AppText variant="heading" style={{ color: colors.onAccent }}>
									+
								</AppText>
							</Pressable>
						</View>
						<Card>
							<EmptyState body={t.nutrition.offline.slot} />
						</Card>
					</View>
				);
			})}
		</>
	);
}

/**
 * The same boxes the loaded day draws, in the same places: one goal card with
 * four rows, then four meal sections. A spinner would tell the user nothing
 * about what is coming.
 */
function DaySkeleton({ label }: { label: string }) {
	return (
		<SkeletonGroup label={label}>
			<Card style={styles.goalCard}>
				<SkeletonBlock width="65%" height={28} />
				<SkeletonBlock height={8} />
				<View style={styles.macros}>
					{[0, 1, 2].map((row) => (
						<View key={row} style={styles.macroRow}>
							<SkeletonBlock height={14} />
							<SkeletonBlock width="65%" height={20} />
						</View>
					))}
				</View>
			</Card>
			{MEAL_SLOTS.map((slot) => (
				<View key={slot} style={styles.section}>
					<SkeletonBlock width="35%" height={18} />
					<Card>
						<SkeletonBlock width="70%" height={13} />
					</Card>
				</View>
			))}
		</SkeletonGroup>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	scroll: { flex: 1 },
	content: { padding: 20, paddingTop: 12, gap: spacing.md, paddingBottom: 40 },
	flex: { flex: 1, minWidth: 0 },
	toolbarButton: {
		minWidth: 44,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	section: { gap: spacing.sm },
	strong: { fontWeight: "700" },

	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
	trainingMarker: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		// `minHeight`, not `height`: at the largest dynamic type sizes a fixed
		// box crops its own label, and a marker that reads "Traine" is worse
		// than one that is taller than the design intended.
		minHeight: 44,
	},
	trainingMarkerGlyph: { color: colors.accent, fontSize: 8 },
	trainingMarkerLabel: { color: colors.textMuted },

	stepper: { alignItems: "center", gap: spacing.xs },
	todayPill: {
		// 44pt so the target meets platform guidance without relying on hitSlop
		// to make up the difference, and so the label has room to grow.
		minHeight: 44,
		paddingHorizontal: spacing.md,
		borderRadius: radius.pill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.accent,
	},

	goalCard: { gap: spacing.md },
	summaryCard: { gap: spacing.sm },
	summaryHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: spacing.sm,
	},
	macros: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.md,
		paddingTop: spacing.sm,
	},
	summaryEnergy: { gap: 2, paddingBottom: spacing.xs },
	macroRow: {
		flexGrow: 1,
		flexBasis: 80,
		minWidth: 80,
		gap: 4,
	},
	macroValue: { gap: 2 },
	editGoals: {
		minHeight: 44,
		justifyContent: "center",
		alignItems: "flex-end",
	},
	goalRow: { gap: 6 },
	goalHeader: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
	// The nutrient's name yields before its number does. Spec #68 is explicit
	// that dynamic type must not clip nutrition values, and in a row with one
	// of each there has to be a rule about which one gives way.
	goalName: { fontWeight: "700", flexShrink: 1 },
	comboControls: { gap: spacing.sm },
	comboActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	track: {
		height: 8,
		borderRadius: radius.pill,
		backgroundColor: colors.surface2,
		overflow: "hidden",
	},
	fill: { height: 8, borderRadius: radius.pill },

	mealHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	mealActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	addButton: {
		minWidth: 44,
		minHeight: 44,
		padding: 4,
		borderRadius: radius.pill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.accent,
	},

	entryRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingVertical: 12,
		minHeight: 56,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	entryEnergy: {
		fontWeight: "700",
		textAlign: "right",
		maxWidth: "38%",
		flexShrink: 1,
	},
	comboPart: { paddingLeft: spacing.sm },

	disclosure: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		minHeight: 44,
	},

	attribution: { gap: 2, paddingTop: spacing.sm },
});
