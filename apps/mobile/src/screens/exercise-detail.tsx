/**
 * One exercise: what you can lift, and everything you have lifted. Ported from
 * the web's `src/routes/exercises/$id.tsx`.
 *
 * All three of the web's tabs. Per-row 1RM in History is computed here rather
 * than read from `oneRepMaxes`, matching the web: the stored record is your
 * current best across all sets, whereas each row wants what *that* set was
 * worth on its own.
 *
 * The strength curve is the one chart worth explaining. For each rep count it
 * plots the heaviest set you have actually logged at exactly that many reps,
 * against what Epley says you *should* manage there given your current 1RM.
 * Points below the line are rep ranges you have not pushed; points above mean
 * your 1RM estimate is stale.
 */
import { calculateOneRepMax } from "@workouts/core";
import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api, type Id } from "../convex/api";
import { formatSessionDate } from "../data/session-data";
import { colors, radius, spacing } from "../theme";
import { TrendChart } from "../ui/chart";
import { Card, Chip, Eyebrow, StatBox } from "../ui/coach";
import { ScreenHeader } from "../ui/screen-header";
import { AppText } from "../ui/text";

const TABS = ["Overview", "Progress", "History"] as const;
type Tab = (typeof TABS)[number];

/** Rep counts the strength curve covers — beyond ten, Epley stops meaning much. */
const CURVE_REPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function ExerciseDetailScreen() {
	const params = useLocalSearchParams<{ id?: string }>();
	const exerciseId = params.id as Id<"exercises"> | undefined;

	const [tab, setTab] = useState<Tab>("Overview");

	const exercise = useQuery(
		api.exercises.getById,
		exerciseId ? { id: exerciseId } : "skip",
	);
	const history = useQuery(
		api.exercises.getHistory,
		exerciseId ? { exerciseId } : "skip",
	);
	const currentOrm = useQuery(
		api.oneRepMaxes.getCurrentForExercise,
		exerciseId ? { exerciseId } : "skip",
	);

	/** Heaviest set, most reps at any weight, and best estimated single. */
	const records = useMemo(() => {
		if (!history || history.length === 0) return null;
		let heaviest = history[0];
		let mostReps = history[0];
		let bestEstimate = 0;
		for (const set of history) {
			if (set.weight > heaviest.weight) heaviest = set;
			if (set.reps > mostReps.reps) mostReps = set;
			if (set.weight > 0) {
				const { value } = calculateOneRepMax(set.weight, set.reps);
				if (value > bestEstimate) bestEstimate = value;
			}
		}
		return { heaviest, mostReps, bestEstimate };
	}, [history]);

	if (exercise === undefined) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="caption">Loading…</AppText>
			</View>
		);
	}

	if (exercise === null) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="heading">Exercise not found</AppText>
				<AppText variant="caption" style={styles.centeredText}>
					It may have been deleted, or belong to someone else.
				</AppText>
			</View>
		);
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<View style={styles.header}>
				<View style={styles.flex}>
					<ScreenHeader title={exercise.name} />
					<AppText variant="caption" style={styles.meta}>
						{exercise.category} · {exercise.equipment}
					</AppText>
				</View>
			</View>

			{exercise.muscleGroups.length > 0 ? (
				<View style={styles.chipWrap}>
					{exercise.muscleGroups.map((mg) => (
						<Chip key={mg} label={mg} />
					))}
				</View>
			) : null}

			<View style={styles.tabRow}>
				{TABS.map((t) => (
					<Pressable key={t} onPress={() => setTab(t)} style={styles.flex}>
						<Chip label={t} active={t === tab} />
					</Pressable>
				))}
			</View>

			{tab === "Overview" ? (
				<>
					<Card style={styles.ormCard}>
						<Eyebrow>Current 1RM</Eyebrow>
						{currentOrm === undefined ? (
							<AppText variant="caption">Loading…</AppText>
						) : currentOrm === null ? (
							<AppText variant="caption">
								No 1RM yet — log a set and one appears.
							</AppText>
						) : (
							<>
								<AppText style={styles.ormValue}>
									{currentOrm.value}{" "}
									<AppText style={styles.ormUnit}>{currentOrm.unit}</AppText>
								</AppText>
								<AppText variant="caption">
									{currentOrm.source === "calculated"
										? "Estimated from your best set (Epley)"
										: currentOrm.source === "actual"
											? "An actual single you lifted"
											: "Entered manually"}
								</AppText>
							</>
						)}
					</Card>

					{records ? (
						<>
							<Eyebrow>Personal records</Eyebrow>
							<View style={styles.statRow}>
								<StatBox
									value={String(records.heaviest.weight)}
									unit="kg"
									label="Heaviest"
								/>
								<StatBox
									value={String(records.mostReps.reps)}
									label="Most reps"
								/>
								<StatBox
									value={
										records.bestEstimate > 0
											? String(records.bestEstimate)
											: "—"
									}
									unit={records.bestEstimate > 0 ? "kg" : undefined}
									label="Best est. 1RM"
									color={colors.accent}
								/>
							</View>
						</>
					) : null}

					{exercise.notes ? (
						<>
							<Eyebrow>Notes</Eyebrow>
							<Card>
								<AppText variant="body">{exercise.notes}</AppText>
							</Card>
						</>
					) : null}

					{exercise.instructions && exercise.instructions.length > 0 ? (
						<>
							<Eyebrow>How to</Eyebrow>
							<Card style={styles.instructions}>
								{exercise.instructions.map((line, i) => (
									// Instructions are a fixed ordered list with no ids; the
									// index is the only stable key and the order never shifts.
									// biome-ignore lint/suspicious/noArrayIndexKey: static ordered list
									<AppText key={i} variant="body" style={styles.step}>
										{i + 1}. {line}
									</AppText>
								))}
							</Card>
						</>
					) : null}
				</>
			) : tab === "Progress" ? (
				<ProgressTab
					exerciseId={exerciseId}
					history={history}
					currentOrm={currentOrm ?? null}
				/>
			) : (
				<HistoryTab history={history} />
			)}
		</ScrollView>
	);
}

function ProgressTab({
	exerciseId,
	history,
	currentOrm,
}: {
	exerciseId: Id<"exercises"> | undefined;
	history: ReturnType<typeof useQuery<typeof api.exercises.getHistory>>;
	currentOrm: { value: number } | null;
}) {
	const ormHistory = useQuery(
		api.oneRepMaxes.listForExercise,
		exerciseId ? { exerciseId } : "skip",
	);

	const ormPoints = useMemo(
		() =>
			(ormHistory ?? []).map((o) => ({
				value: o.value,
				label: new Date(o.date).toLocaleDateString(undefined, {
					day: "numeric",
					month: "short",
				}),
			})),
		[ormHistory],
	);

	/** Heaviest weight actually logged at each rep count in `CURVE_REPS`. */
	const actualCurve = useMemo(() => {
		const best = new Map<number, number>();
		for (const set of history ?? []) {
			if (set.weight <= 0) continue;
			const existing = best.get(set.reps) ?? 0;
			if (set.weight > existing) best.set(set.reps, set.weight);
		}
		return CURVE_REPS.map((reps) => ({
			value: best.get(reps) ?? 0,
			label: `${reps}`,
		}));
	}, [history]);

	/**
	 * Epley inverted: given a 1RM, the weight that formula predicts for n reps.
	 * `1rm = w × (1 + n/30)`, so `w = 1rm ÷ (1 + n/30)`.
	 */
	const theoreticalCurve = useMemo(() => {
		if (!currentOrm) return [];
		return CURVE_REPS.map((reps) => ({
			value: Math.round((currentOrm.value / (1 + reps / 30)) * 10) / 10,
			label: `${reps}`,
		}));
	}, [currentOrm]);

	const hasCurve = actualCurve.some((p) => p.value > 0);

	return (
		<>
			<TrendChart title="1RM over time" points={ormPoints} />

			{hasCurve ? (
				<TrendChart
					title="Strength curve — logged"
					note="Heaviest set at each rep count."
					points={actualCurve.filter((p) => p.value > 0)}
				/>
			) : null}

			{theoreticalCurve.length > 0 ? (
				<TrendChart
					title="Strength curve — predicted"
					note="What Epley expects at each rep count, from your current 1RM."
					points={theoreticalCurve}
					color={colors.textMuted}
				/>
			) : null}
		</>
	);
}

function HistoryTab({
	history,
}: {
	history: ReturnType<typeof useQuery<typeof api.exercises.getHistory>>;
}) {
	if (history === undefined) {
		return <AppText variant="caption">Loading…</AppText>;
	}

	if (history.length === 0) {
		return (
			<View style={styles.empty}>
				<AppText variant="heading" style={{ color: colors.textMuted }}>
					Nothing logged yet
				</AppText>
				<AppText variant="caption" style={styles.centeredText}>
					Sets you log for this exercise show up here.
				</AppText>
			</View>
		);
	}

	// Newest first: the last thing you did is the thing you want to see.
	const rows = [...history].reverse();

	return (
		<View style={styles.historyList}>
			<View style={styles.historyHead}>
				<AppText style={[styles.th, styles.flex]}>Date</AppText>
				<AppText style={[styles.th, styles.center, { width: 56 }]}>kg</AppText>
				<AppText style={[styles.th, styles.center, { width: 44 }]}>
					Reps
				</AppText>
				<AppText style={[styles.th, styles.center, { width: 64 }]}>
					Est. 1RM
				</AppText>
			</View>
			{rows.map((set) => {
				const estimate =
					set.weight > 0 ? calculateOneRepMax(set.weight, set.reps) : null;
				return (
					<View key={set._id} style={styles.historyRow}>
						<View style={styles.flex}>
							<AppText variant="caption" style={styles.historyDate}>
								{formatSessionDate(set.sessionDate)}
							</AppText>
							<AppText variant="caption" style={styles.historyType}>
								{set.setType}
							</AppText>
						</View>
						<AppText style={[styles.td, styles.center, { width: 56 }]}>
							{set.weight}
						</AppText>
						<AppText style={[styles.td, styles.center, { width: 44 }]}>
							{set.reps}
						</AppText>
						<AppText style={[styles.td, styles.center, { width: 64 }]}>
							{estimate ? estimate.value : "—"}
						</AppText>
					</View>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
	centered: { alignItems: "center", justifyContent: "center", gap: spacing.sm },
	centeredText: { textAlign: "center" },
	header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	flex: { flex: 1 },
	meta: { textTransform: "capitalize" },
	chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 },
	tabRow: { flexDirection: "row", gap: spacing.xs + 2, marginTop: spacing.xs },
	ormCard: { gap: spacing.xs },
	ormValue: { fontSize: 32, fontWeight: "800", color: colors.text },
	ormUnit: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
	statRow: { flexDirection: "row", gap: spacing.sm },
	instructions: { gap: spacing.sm },
	step: { color: colors.textMuted },
	empty: { alignItems: "center", gap: 4, paddingVertical: spacing.xl },
	historyList: { gap: 2 },
	historyHead: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.xs,
		paddingBottom: spacing.xs,
	},
	th: {
		fontSize: 9,
		fontWeight: "800",
		letterSpacing: 0.5,
		textTransform: "uppercase",
		color: colors.textFaint,
	},
	center: { textAlign: "center" },
	historyRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.sm,
	},
	historyDate: { color: colors.text, fontWeight: "600" },
	historyType: { textTransform: "capitalize" },
	td: { fontSize: 13, fontWeight: "700", color: colors.text },
	ghostBtn: {
		minHeight: 44,
		paddingHorizontal: spacing.lg,
		borderRadius: radius.pill,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		alignItems: "center",
		justifyContent: "center",
	},
	ghostText: { fontSize: 13, fontWeight: "800", color: colors.text },
});
