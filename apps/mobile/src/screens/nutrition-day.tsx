/**
 * The Nutrition day — the fifth tab's front door.
 *
 * Hierarchy is Variant A ("Goals first") from prototype #67, in that order and
 * for that reason: date, then goal progress, then the four meal slots, then the
 * nutrients nobody has targeted, then the attribution the NEVO licence
 * requires. Progress is what the person opened the tab to see; the diary is
 * what they came to change. The prototype is evidence for the hierarchy, not
 * markup to port — everything here is plain React Native.
 *
 * The day itself is a `YYYY-MM-DD` string in the device's local calendar and
 * defaults to today (see `src/data/calendar-day.ts` for why it is not a
 * timestamp).
 *
 * Goals and entries come from `src/data/nutrition-day.ts`, which is a marked
 * placeholder that #70 and #72 replace with Convex queries. Goal setup still
 * says that it belongs to a later update; each meal's plus now opens #71's
 * shipped-food browser and serving preview.
 */

import { type NutrientTotal, roundForDisplay } from "@workouts/core/nutrition";
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
import { useTrainingMarker } from "../data/training-marker";
import { fmt, type Messages, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { DateStepper } from "../ui/date-stepper";
import { EmptyState } from "../ui/empty-state";
import { SkeletonBlock, SkeletonGroup } from "../ui/skeleton";
import { type RowAccessibilityProps, SwipeableRow } from "../ui/swipeable-row";
import { AppText } from "../ui/text";
import {
	NutritionComboBuilder,
	NutritionComboLibrary,
} from "./nutrition-combos";
import { NutritionEntryEditor } from "./nutrition-entry-editor";
import { NutritionFoodBrowser } from "./nutrition-food-browser";

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
	const [addingTo, setAddingTo] = useState<MealSlot>();
	const [editing, setEditing] = useState<{
		entry: DiaryEntry;
		meal: MealSlot;
	}>();
	const [comboMode, setComboMode] = useState<"select" | "library">();
	const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(
		() => new Set(),
	);
	const [comboEntries, setComboEntries] = useState<DiaryEntry[]>();

	const { deleteEntry } = useDeleteDiaryEntry();
	const state = useNutritionDay(date);
	const marker = useTrainingMarker(date);
	const offset = isoDayOffset(today, date);

	const dayLabel =
		offset === 0
			? t.nutrition.day.today
			: offset === -1
				? t.nutrition.day.yesterday
				: offset === 1
					? t.nutrition.day.tomorrow
					: formatLongDate(date, locale);

	if (addingTo) {
		return (
			<NutritionFoodBrowser
				meal={addingTo}
				date={date}
				onClose={() => setAddingTo(undefined)}
			/>
		);
	}

	if (editing) {
		return (
			<NutritionEntryEditor
				entry={editing.entry}
				meal={editing.meal}
				date={date}
				onClose={() => setEditing(undefined)}
			/>
		);
	}

	if (comboEntries) {
		return (
			<NutritionComboBuilder
				entries={comboEntries}
				onClose={() => setComboEntries(undefined)}
				onSaved={() => {
					setComboEntries(undefined);
					setComboMode(undefined);
					setSelectedEntryIds(new Set());
				}}
			/>
		);
	}

	if (comboMode === "library") {
		return (
			<NutritionComboLibrary
				date={date}
				onClose={() => setComboMode(undefined)}
			/>
		);
	}

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<View style={styles.headerRow}>
				<View style={styles.flex}>
					<Eyebrow>{t.nutrition.title}</Eyebrow>
					<AppText variant="title">{dayLabel}</AppText>
				</View>
				{marker === "visible" ? <TrainingMarker t={t} /> : null}
			</View>

			<DayDateStepper
				date={date}
				locale={locale}
				t={t}
				isToday={offset === 0}
				onChange={setDate}
				onToday={() => setDate(today)}
			/>

			{state.status === "loading" ? (
				<DaySkeleton label={t.nutrition.day.loading} />
			) : (
				<>
					<GoalSection
						t={t}
						goals={state.day.goals}
						totals={state.day.totals}
						onSetUpGoals={() => router.push("/nutrition-goals")}
					/>

					<ComboControls
						t={t}
						selecting={comboMode === "select"}
						selectedCount={selectedEntryIds.size}
						onCreate={() => setComboMode("select")}
						onLog={() => setComboMode("library")}
						onCancel={() => {
							setComboMode(undefined);
							setSelectedEntryIds(new Set());
						}}
						onContinue={() => {
							const selected = MEAL_SLOTS.flatMap(
								(slot) => state.day.entries[slot],
							).filter((entry) => selectedEntryIds.has(entry.id));
							if (selected.length > 0) setComboEntries(selected);
						}}
					/>

					{MEAL_SLOTS.map((slot) => (
						<MealSection
							key={slot}
							t={t}
							slot={slot}
							entries={state.day.entries[slot]}
							locale={locale}
							onAdd={() => setAddingTo(slot)}
							onEdit={(entry) => setEditing({ entry, meal: slot })}
							onDelete={(entry) => deleteEntry({ entry, meal: slot, date })}
							selecting={comboMode === "select"}
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
						totals={state.day.totals}
						expanded={showOther}
						onToggle={() => setShowOther((open) => !open)}
					/>
				</>
			)}

			<View style={styles.attribution}>
				<AppText variant="caption">{t.nutrition.attribution.nevo}</AppText>
				<AppText variant="caption">{t.nutrition.attribution.salt}</AppText>
				<AppText variant="caption">
					{t.nutrition.attribution.incomplete}
				</AppText>
			</View>
		</ScrollView>
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
	locale,
	t,
	isToday,
	onChange,
	onToday,
}: {
	date: string;
	locale: string;
	t: Messages;
	isToday: boolean;
	onChange: (next: string) => void;
	onToday: () => void;
}) {
	return (
		<View style={styles.stepper}>
			<View style={styles.flex}>
				<DateStepper
					date={date}
					locale={locale}
					previousLabel={t.nutrition.day.previousDay}
					nextLabel={t.nutrition.day.nextDay}
					onChange={onChange}
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
	return (
		<View style={styles.section}>
			<Eyebrow>{t.nutrition.goals.heading}</Eyebrow>
			<Card style={styles.goalCard}>
				{goals.length === 0 ? (
					<EmptyState
						title={t.nutrition.goals.empty.title}
						body={t.nutrition.goals.empty.body}
						action={{
							label: t.nutrition.goals.empty.action,
							onPress: onSetUpGoals,
						}}
					/>
				) : (
					<>
						{goals.map((goal) => (
							<GoalRow
								key={`${goal.nutrient}-${goal.direction}`}
								t={t}
								goal={goal}
								total={totals[goal.nutrient]}
							/>
						))}
						<Pressable
							onPress={onSetUpGoals}
							accessibilityRole="button"
							style={styles.editGoals}
						>
							<AppText variant="caption" style={{ color: colors.accent }}>
								{t.nutrition.goals.edit}
							</AppText>
						</Pressable>
					</>
				)}
			</Card>
		</View>
	);
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
			accessibilityLabel={`${name}: ${progress}. ${stateWord}.`}
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
			<AppText variant="caption" style={{ color: STATE_COLOR[state] }}>
				{stateWord}
			</AppText>
		</View>
	);
}

function ComboControls({
	t,
	selecting,
	selectedCount,
	onCreate,
	onLog,
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

	return (
		<View style={styles.comboActions}>
			<GhostButton label={t.nutrition.combos.create} onPress={onCreate} />
			<GhostButton label={t.nutrition.combos.log} onPress={onLog} />
		</View>
	);
}

function MealSection({
	t,
	slot,
	entries,
	locale,
	onAdd,
	onEdit,
	onDelete,
	selecting,
	selectedEntryIds,
	onToggleEntry,
}: {
	t: Messages;
	slot: MealSlot;
	entries: DiaryEntry[];
	locale: "en" | "nl";
	onAdd: () => void;
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

	return (
		<View style={styles.section}>
			<View style={styles.mealHeader}>
				<AppText variant="heading">{mealName}</AppText>
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
									locale={locale}
									selecting={selecting}
									selected={selectedEntryIds.has(entry.id)}
									onPress={() =>
										selecting ? onToggleEntry(entry) : onEdit(entry)
									}
									onDelete={() => onDelete(entry)}
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
									<AppText variant="heading">{expanded ? "⌃" : "⌄"}</AppText>
								</Pressable>
								{expanded
									? parts.map((part) => (
											<EntryRow
												key={part.id}
												t={t}
												entry={part}
												locale={locale}
												selecting={selecting}
												selected={selectedEntryIds.has(part.id)}
												onPress={() =>
													selecting ? onToggleEntry(part) : onEdit(part)
												}
												onDelete={() => onDelete(part)}
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
	t,
	entry,
	locale,
	selecting,
	selected,
	onPress,
	onDelete,
}: {
	t: Messages;
	entry: DiaryEntry;
	locale: "en" | "nl";
	selecting: boolean;
	selected: boolean;
	onPress: () => void;
	onDelete: () => void;
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
				styles.entryRow,
				styles.comboPart,
				pressed ? { backgroundColor: colors.surface2 } : null,
			]}
		>
			{selecting ? (
				<AppText style={{ color: selected ? colors.accent : colors.textMuted }}>
					{selected ? "☑" : "☐"}
				</AppText>
			) : null}
			<View style={styles.flex}>
				<AppText style={styles.goalName}>{entry.name[locale]}</AppText>
				<AppText variant="caption">{entry.serving[locale]}</AppText>
			</View>
			<AppText style={styles.goalName}>
				{entry.nutrients.energy.kind === "value"
					? roundForDisplay("energy", entry.nutrients.energy.amount)
					: entry.nutrients.energy.kind === "trace"
						? t.nutrition.foodBrowser.trace
						: t.nutrition.foodBrowser.absent}{" "}
				{t.nutrition.units.kcal}
			</AppText>
		</Pressable>
	);

	if (selecting) return content();

	return (
		<SwipeableRow
			menuTitle={fmt(t.nutrition.entryActions.menuTitle, {
				name: entry.name[locale],
			})}
			closeMenuLabel={t.nutrition.entryActions.close}
			actions={[
				{ key: "edit", label: t.nutrition.entryActions.edit, onPress },
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
 * The same boxes the loaded day draws, in the same places: one goal card with
 * four rows, then four meal sections. A spinner would tell the user nothing
 * about what is coming.
 */
function DaySkeleton({ label }: { label: string }) {
	return (
		<SkeletonGroup label={label}>
			<Card style={styles.goalCard}>
				{[0, 1, 2, 3].map((row) => (
					<View key={row} style={styles.goalRow}>
						<SkeletonBlock width="40%" height={15} />
						<SkeletonBlock height={8} />
					</View>
				))}
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
	content: { padding: 20, paddingTop: 12, gap: spacing.md, paddingBottom: 40 },
	flex: { flex: 1 },
	section: { gap: spacing.sm },

	headerRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
	trainingMarker: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		height: 44,
	},
	trainingMarkerGlyph: { color: colors.accent, fontSize: 8 },
	trainingMarkerLabel: { color: colors.textMuted },

	stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	todayPill: {
		height: 32,
		paddingHorizontal: spacing.md,
		borderRadius: radius.pill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.accent,
	},

	goalCard: { gap: spacing.md },
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
	goalName: { fontWeight: "700" },
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
	addButton: {
		width: 44,
		height: 44,
		borderRadius: radius.pill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.accent,
	},

	entryRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingVertical: 6,
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
