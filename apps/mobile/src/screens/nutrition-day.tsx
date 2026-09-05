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
 * placeholder that #70 and #72 replace with Convex queries. The two controls
 * that would open screens those tickets own — "Set up goals" and each slot's
 * plus — say so rather than doing nothing when pressed. A control that responds
 * with nothing at all is indistinguishable from a broken one.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
	formatLongDate,
	isoDayOffset,
	shiftIsoDate,
	todayIsoDate,
} from "../data/calendar-day";
import {
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
import { fmt, type Messages, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { Card, Eyebrow } from "../ui/coach";
import { EmptyState } from "../ui/empty-state";
import { SkeletonBlock, SkeletonGroup } from "../ui/skeleton";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

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
	const toast = useToast();

	// Read once per mount rather than per render: a day that changes underneath
	// the user mid-scroll because midnight passed is worse than one that is
	// right again on the next visit.
	const [today] = useState(todayIsoDate);
	const [date, setDate] = useState(today);
	const [showOther, setShowOther] = useState(false);

	const state = useNutritionDay(date);
	const offset = isoDayOffset(today, date);

	const dayLabel =
		offset === 0
			? t.nutrition.day.today
			: offset === -1
				? t.nutrition.day.yesterday
				: offset === 1
					? t.nutrition.day.tomorrow
					: formatLongDate(date, locale);

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<View>
				<Eyebrow>{t.nutrition.title}</Eyebrow>
				<AppText variant="title">{dayLabel}</AppText>
			</View>

			<DateStepper
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
						onSetUpGoals={() => toast.error(t.nutrition.goals.unavailable)}
					/>

					{MEAL_SLOTS.map((slot) => (
						<MealSection
							key={slot}
							t={t}
							slot={slot}
							entries={state.day.entries[slot]}
							onAdd={() => toast.error(t.nutrition.addUnavailable)}
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

function DateStepper({
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
			<StepperButton
				label={t.nutrition.day.previousDay}
				glyph="‹"
				onPress={() => onChange(shiftIsoDate(date, -1))}
			/>
			<AppText style={styles.stepperDate}>
				{formatLongDate(date, locale)}
			</AppText>
			<StepperButton
				label={t.nutrition.day.nextDay}
				glyph="›"
				onPress={() => onChange(shiftIsoDate(date, 1))}
			/>
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

function StepperButton({
	label,
	glyph,
	onPress,
}: {
	label: string;
	glyph: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={({ pressed }) => [
				styles.iconButton,
				pressed ? { backgroundColor: colors.surface2 } : null,
			]}
		>
			<AppText variant="heading" style={{ color: colors.accent }}>
				{glyph}
			</AppText>
		</Pressable>
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
	totals: Partial<Record<NutrientKey, number>>;
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
					goals.map((goal) => (
						<GoalRow
							key={`${goal.nutrient}-${goal.direction}`}
							t={t}
							goal={goal}
							total={totals[goal.nutrient]}
						/>
					))
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
	total: number | undefined;
}) {
	const state = goalState(goal.direction, total, goal.target);
	const unit = t.nutrition.units[nutrientUnit(goal.nutrient)];
	const name = t.nutrition.nutrients[goal.nutrient];
	const progress = fmt(t.nutrition.goals.progress, {
		total: total ?? 0,
		target: goal.target,
		unit,
	});
	const stateWord = t.nutrition.goals.state[state];
	const fraction = Math.max(0, Math.min(1, (total ?? 0) / goal.target));

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

function MealSection({
	t,
	slot,
	entries,
	onAdd,
}: {
	t: Messages;
	slot: MealSlot;
	entries: { id: string; name: string; serving: string; energy: number }[];
	onAdd: () => void;
}) {
	const mealName = t.nutrition.meals[slot];

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
					entries.map((entry) => (
						<View key={entry.id} style={styles.entryRow}>
							<View style={styles.flex}>
								<AppText style={styles.goalName}>{entry.name}</AppText>
								<AppText variant="caption">{entry.serving}</AppText>
							</View>
							<AppText style={styles.goalName}>
								{entry.energy} {t.nutrition.units.kcal}
							</AppText>
						</View>
					))
				)}
			</Card>
		</View>
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
	totals: Partial<Record<NutrientKey, number>>;
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
								{totals[key] ?? 0} {t.nutrition.units[nutrientUnit(key)]}
							</AppText>
						</View>
					))}
				</Card>
			) : null}
		</View>
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

	stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	stepperDate: { flex: 1, textAlign: "center", fontWeight: "700" },
	iconButton: {
		// 44pt minimum touch target, per the platform's own guidance.
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.pill,
	},
	todayPill: {
		height: 32,
		paddingHorizontal: spacing.md,
		borderRadius: radius.pill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.accent,
	},

	goalCard: { gap: spacing.md },
	goalRow: { gap: 6 },
	goalHeader: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
	goalName: { fontWeight: "700" },
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

	disclosure: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		minHeight: 44,
	},

	attribution: { gap: 2, paddingTop: spacing.sm },
});
