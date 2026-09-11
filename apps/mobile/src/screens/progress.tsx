/**
 * Progress tab, ported from the web's `src/routes/progress/index.tsx`.
 *
 * Two sub-tabs, as on the web: per-exercise trends, and body metrics. The
 * by-sport bars from the original design are gone rather than left as fake
 * data — there is no per-sport record to draw from until the Activity split in
 * ADR-0001 lands, and an invented breakdown is worse than an absent one.
 *
 * One deliberate difference in wording. `progress.weeklyVolume` sums **every**
 * set type, while the session summary's volume counts working sets only. Those
 * are two different numbers and the web labels both "volume", which invites the
 * reader to compare them. The chart here says which one it is instead. Changing
 * the query to match would silently move the web's chart too, so it is left
 * alone and flagged rather than quietly fixed.
 */
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api, type Id } from "../convex/api";
import { useShellData } from "../data/session-data";
import { colors } from "../theme";
import { BucketChart, TrendChart } from "../ui/chart";
import { Chip, Eyebrow, StatBox } from "../ui/coach";
import { AppText } from "../ui/text";
import { BodyMetricsPanel } from "./body-metrics";

const TABS = ["Exercises", "Body"] as const;
type Tab = (typeof TABS)[number];

export function ProgressScreen() {
	const [tab, setTab] = useState<Tab>("Exercises");
	const { recent, exercises } = useShellData();

	const totalMinutes =
		recent?.reduce((sum, s) => {
			if (!s.endTime) return sum;
			return sum + Math.round((s.endTime - s.startTime) / 60000);
		}, 0) ?? 0;

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<AppText style={styles.h1}>Progress</AppText>

			<View style={styles.tabRow}>
				{TABS.map((t) => (
					<Pressable key={t} onPress={() => setTab(t)} style={styles.flex}>
						<Chip label={t} active={t === tab} />
					</Pressable>
				))}
			</View>

			<View style={styles.statRow}>
				<StatBox value={String(recent?.length ?? 0)} label="Sessions" />
				<StatBox
					value={
						totalMinutes >= 60
							? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
							: `${totalMinutes}m`
					}
					label="Active"
				/>
			</View>

			{tab === "Exercises" ? (
				<ExerciseProgress exercises={exercises} />
			) : (
				<BodyMetricsPanel />
			)}
		</ScrollView>
	);
}

function ExerciseProgress({
	exercises,
}: {
	exercises: ReturnType<typeof useShellData>["exercises"];
}) {
	const [selected, setSelected] = useState<Id<"exercises"> | null>(null);

	const ormHistory = useQuery(
		api.oneRepMaxes.listForExercise,
		selected ? { exerciseId: selected } : "skip",
	);
	const weekly = useQuery(
		api.progress.weeklyVolume,
		selected ? { exerciseId: selected } : "skip",
	);

	// Only exercises the user has actually trained are worth offering — the
	// catalog runs to hundreds of rows, almost none of which have a trend.
	const currentOrms = useQuery(api.oneRepMaxes.listCurrentForUser, {});
	const trained = useMemo(() => {
		if (!exercises || !currentOrms) return [];
		const ids = new Set(currentOrms.map((o) => o.exerciseId));
		return exercises.filter((e) => ids.has(e._id));
	}, [exercises, currentOrms]);

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

	const volumePoints = useMemo(
		() =>
			(weekly ?? []).map((w) => ({
				value: w.volume,
				// "2026-W12" → "W12"; the year is constant across a chart this wide.
				label: w.week.split("-")[1] ?? w.week,
			})),
		[weekly],
	);

	if (currentOrms === undefined || exercises === undefined) {
		return <AppText style={styles.muted}>Loading…</AppText>;
	}

	if (trained.length === 0) {
		return (
			<View style={styles.empty}>
				<AppText variant="heading" style={{ color: colors.textMuted }}>
					No exercise data yet
				</AppText>
				<AppText variant="caption" style={styles.centered}>
					Log a few sets and your 1RM and volume trends appear here.
				</AppText>
			</View>
		);
	}

	return (
		<>
			<Eyebrow>Exercise</Eyebrow>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View style={styles.chipRow}>
					{trained.map((e) => (
						<Pressable key={e._id} onPress={() => setSelected(e._id)}>
							<Chip label={e.name} active={e._id === selected} />
						</Pressable>
					))}
				</View>
			</ScrollView>

			{selected === null ? (
				<AppText style={styles.muted}>
					Pick an exercise to see its trends.
				</AppText>
			) : (
				<>
					<TrendChart title="1RM over time" points={ormPoints} />
					<BucketChart
						title="Weekly volume"
						note="Every set type, warmups included."
						points={volumePoints}
					/>
				</>
			)}
		</>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 12, gap: 14, paddingBottom: 24 },
	h1: { fontSize: 22, fontWeight: "800", color: colors.text },
	tabRow: { flexDirection: "row", gap: 7 },
	flex: { flex: 1 },
	statRow: { flexDirection: "row", gap: 8 },
	chipRow: { flexDirection: "row", gap: 7 },
	muted: { fontSize: 13, color: colors.textMuted },
	centered: { textAlign: "center" },
	empty: {
		alignItems: "center",
		gap: 4,
		paddingVertical: 24,
		paddingHorizontal: 16,
		backgroundColor: colors.surface,
		borderRadius: 14,
	},
});
