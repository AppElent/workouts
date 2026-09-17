/** Compact diary: date, goal summary and meals; secondary actions live in menus.
 * Diary rows retain edit/swipe actions and expose Copy/Move through both a
 * visible menu and native long press. Writes use the durable operation service.
 */

import {
	NUTRIENT_KEYS,
	type NutrientTotal,
	roundForDisplay,
	totalNutrients,
} from "@workouts/core/nutrition";
import { useConvexConnectionState } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
	formatLongDate,
	isoDayOffset,
	todayIsoDate,
} from "../data/calendar-day";
import { useDeleteDiaryEntry } from "../data/delete-diary-entry";
import {
	type DiaryEntry,
	MEAL_SLOTS,
	type MealSlot,
	type NutrientGoal,
	type NutrientKey,
	nutrientUnit,
	useNutritionDay,
} from "../data/nutrition-day";
import { isRealIsoDate } from "../data/nutrition-weekly-review";
import { useStalledOffline } from "../data/stalled-offline";
import { useTrainingMarker } from "../data/training-marker";
import { fmt, type Messages, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { DateStepper } from "../ui/date-stepper";
import { EmptyState } from "../ui/empty-state";
import { DisclosureRow, FormSection, GroupedSurface } from "../ui/form";
import { NutritionCalendar } from "../ui/nutrition-calendar";
import { SkeletonBlock, SkeletonGroup } from "../ui/skeleton";
import { type RowAccessibilityProps, SwipeableRow } from "../ui/swipeable-row";
import { AppText } from "../ui/text";
import { NutritionEntryTransfer } from "./nutrition-entry-transfer";
import { NutritionGoalCard } from "./nutrition-goal-card";
import { NutritionHeaderMenu } from "./nutrition-header-menu";
import { NutritionMenu } from "./nutrition-menu";
import { NutritionSyncStatus } from "./nutrition-sync-status";

export function NutritionDayScreen({
	initialDate,
}: {
	initialDate?: string;
} = {}) {
	const { t, locale } = useI18n();
	const router = useRouter();

	// Read once per mount rather than per render: a day that changes underneath
	// the user mid-scroll because midnight passed is worse than one that is
	// right again on the next visit.
	const [today] = useState(todayIsoDate);
	const [date, setDate] = useState(() =>
		isRealDate(initialDate) ? initialDate : today,
	);
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
	useEffect(() => {
		if (!isRealDate(initialDate)) return;
		setDate(initialDate);
		setShowCalendar(false);
		setSelecting(false);
		setSelectedEntryIds(new Set());
	}, [initialDate]);

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
		const combined: Partial<Record<NutrientKey, NutrientTotal>> = {
			...totalNutrients(entries.map((entry) => entry.nutrients)),
			...state.day.totals,
		};
		for (const nutrient of NUTRIENT_KEYS) {
			const hasEstimatedContribution = entries.some(
				(entry) =>
					entry.estimated && entry.nutrients[nutrient].kind !== "absent",
			);
			const total = combined[nutrient];
			if (hasEstimatedContribution && total)
				combined[nutrient] = { ...total, qualified: true };
		}
		return combined;
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
		<>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				automaticallyAdjustKeyboardInsets
				keyboardDismissMode="interactive"
				style={[styles.root, styles.scroll]}
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
						<NutritionGoalCard
							t={t}
							goals={state.day.goals}
							totals={totals}
							displayOrder={state.day.displayOrder}
							onEdit={(nutrient) =>
								router.push({
									pathname: "/nutrition-goals",
									params: { date, ...(nutrient ? { nutrient } : {}) },
								})
							}
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
			<Stack.Screen
				options={{
					headerRight: () => (
						<NutritionHeaderMenu
							label={
								locale === "nl"
									? "Meer voedingsfuncties"
									: "More nutrition tools"
							}
							closeLabel={t.nutrition.entryActions.close}
							weekOverviewLabel={
								locale === "nl" ? "Weekoverzicht" : "Week overview"
							}
							createComboLabel={t.nutrition.combos.create}
							logComboLabel={t.nutrition.combos.log}
							captureDraftsLabel={
								locale === "nl" ? "Onvoltooide invoer" : "Unfinished logs"
							}
							assistanceLabel={
								locale === "nl"
									? "Tekst en voedingsetiket"
									: "Text and nutrition label"
							}
							backupLabel={
								locale === "nl"
									? "Back-up van voedingsbibliotheek"
									: "Food library backup"
							}
							goalsLabel={t.nutrition.goals.edit}
							dataSourcesLabel={
								locale === "nl" ? "Gegevensbronnen" : "Data sources"
							}
							onCreateCombo={() => setSelecting(true)}
							onOpenWeekOverview={() =>
								router.push({
									pathname: "/nutrition-weekly-review",
									params: { startDate: date },
								})
							}
							onLogCombo={() =>
								router.push({
									pathname: "/nutrition-combos",
									params: { date },
								})
							}
							onOpenCaptureDrafts={() =>
								router.push({
									pathname: "/nutrition-cooking",
									params: { date, meal: "breakfast" },
								})
							}
							onOpenAssistance={() =>
								router.push({
									pathname: "/nutrition-assistance",
									params: { date, meal: "breakfast" },
								})
							}
							onOpenBackup={() => router.push("/nutrition-library")}
							onOpenGoals={() => router.push("/nutrition-goals")}
							onToggleDataSources={() => setShowTools((open) => !open)}
						/>
					),
				}}
			/>
			{transfer ? (
				<NutritionEntryTransfer
					{...transfer}
					date={date}
					onClose={() => setTransfer(null)}
				/>
			) : null}
		</>
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
			<GroupedSurface style={styles.comboControls}>
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
			</GroupedSurface>
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
			<GroupedSurface>
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
			</GroupedSurface>
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
	const estimateLabel =
		locale === "nl" ? "Geschatte voedingswaarden" : "Estimated nutrition";
	const content = (accessibility?: RowAccessibilityProps) => (
		<Pressable
			onPress={onPress}
			accessibilityRole={selecting ? "checkbox" : "button"}
			accessibilityState={selecting ? { checked: selected } : undefined}
			accessibilityLabel={
				(selecting
					? fmt(t.nutrition.combos.selectEntry, {
							name: entry.name[locale],
						})
					: fmt(t.nutrition.entryEditor.editEntry, {
							name: entry.name[locale],
						})) + (entry.estimated ? `. ${estimateLabel}` : "")
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
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing.xs,
						}}
					>
						<AppText style={[styles.goalName, { flexShrink: 1 }]}>
							{entry.name[locale]}
						</AppText>
						{entry.estimated ? (
							<SymbolView
								name={{
									ios: "plus.forwardslash.minus",
									android: "calculate",
									web: "calculate",
								}}
								size={14}
								tintColor={colors.textMuted}
								accessibilityLabel={estimateLabel}
								accessibilityRole="image"
							/>
						) : null}
					</View>
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
		<FormSection>
			<DisclosureRow
				label={t.nutrition.otherNutrients.heading}
				onPress={onToggle}
				expanded={expanded}
				accessibilityLabel={
					expanded
						? t.nutrition.otherNutrients.hide
						: t.nutrition.otherNutrients.show
				}
			/>
			{expanded
				? others.map((key) => (
						<View key={key} style={[styles.entryRow, styles.groupedEntryRow]}>
							<AppText style={styles.flex}>
								{t.nutrition.nutrients[key]}
							</AppText>
							<AppText variant="caption">
								{qualifiedAmount(key, totals[key])}{" "}
								{t.nutrition.units[nutrientUnit(key)]}
							</AppText>
						</View>
					))
				: null}
		</FormSection>
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
			<GroupedSurface style={styles.goalCard}>
				<EmptyState
					title={t.nutrition.offline.title}
					body={t.nutrition.offline.body}
				/>
			</GroupedSurface>
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
						<GroupedSurface>
							<EmptyState body={t.nutrition.offline.slot} />
						</GroupedSurface>
					</View>
				);
			})}
		</>
	);
}

/**
 * The same boxes the loaded day draws, in the same places: one goal card with
 * two full rows plus a teaser, then four meal sections. A spinner would tell the user nothing
 * about what is coming.
 */
function DaySkeleton({ label }: { label: string }) {
	return (
		<SkeletonGroup label={label}>
			<GroupedSurface style={styles.goalCard}>
				<View style={styles.skeletonGoalHeader}>
					<SkeletonBlock width="28%" height={14} />
					<SkeletonBlock width={76} height={28} />
				</View>
				{[0, 1].map((row) => (
					<View key={row} style={styles.skeletonGoalRow}>
						<View style={styles.skeletonGoalHeader}>
							<SkeletonBlock width="30%" height={16} />
							<SkeletonBlock width="45%" height={14} />
						</View>
						<SkeletonBlock height={8} />
						<SkeletonBlock width="32%" height={13} />
					</View>
				))}
				<View style={styles.skeletonTeaser}>
					<SkeletonBlock height={8} />
				</View>
			</GroupedSurface>
			{MEAL_SLOTS.map((slot) => (
				<View key={slot} style={styles.section}>
					<SkeletonBlock width="35%" height={18} />
					<GroupedSurface>
						<SkeletonBlock width="70%" height={13} />
					</GroupedSurface>
				</View>
			))}
		</SkeletonGroup>
	);
}

function isRealDate(value: string | undefined): value is string {
	return value !== undefined && isRealIsoDate(value);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	scroll: { flex: 1 },
	content: { padding: 20, paddingTop: 12, gap: spacing.md, paddingBottom: 40 },
	flex: { flex: 1, minWidth: 0 },
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
	skeletonGoalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: spacing.sm,
	},
	skeletonGoalRow: { gap: 6 },
	skeletonTeaser: { opacity: 0.35, height: 12, overflow: "hidden" },
	// The nutrient's name yields before its number does. Spec #68 is explicit
	// that dynamic type must not clip nutrition values, and in a row with one
	// of each there has to be a rule about which one gives way.
	goalName: { fontWeight: "700", flexShrink: 1 },
	comboControls: { gap: spacing.sm },
	comboActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
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
	groupedEntryRow: {
		paddingHorizontal: spacing.md,
		borderBottomWidth: 0,
	},

	attribution: { gap: 2, paddingTop: spacing.sm },
});
