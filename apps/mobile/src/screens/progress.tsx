import type { ExerciseId } from "@workouts/core/exercises";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../convex/api";
import { useShellData } from "../data/session-data";
import { useI18n } from "../i18n";
import { type Tokens, useThemedStyles, useTokens } from "../theme";
import { BucketChart, TrendChart } from "../ui/chart";
import { Chip, Eyebrow } from "../ui/coach";
import { Segmented } from "../ui/segmented";
import { AppText } from "../ui/text";
import { activityCopy } from "./activity-copy";
import { BodyMetricsPanel } from "./body-metrics";
import { EnduranceProgress } from "./endurance-progress";

const TABS = ["Exercises", "Running", "Cycling", "Body"] as const;
type Tab = (typeof TABS)[number];

export function ProgressScreen() {
	const styles = useThemedStyles(createStyles);
	const [tab, setTab] = useState<Tab>("Exercises");
	const { exercises } = useShellData();
	const { locale } = useI18n();
	const copy = activityCopy(locale);

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<Segmented
				value={tab}
				onChange={setTab}
				options={TABS.map((value) => ({
					value,
					label:
						value === "Exercises"
							? copy.exercises
							: value === "Body"
								? copy.body
								: value === "Running"
									? copy.running
									: copy.cycling,
				}))}
			/>

			{tab === "Exercises" ? (
				<ExerciseProgress exercises={exercises} />
			) : tab === "Running" || tab === "Cycling" ? (
				<EnduranceProgress
					key={tab}
					sport={tab === "Running" ? "running" : "cycling"}
				/>
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
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const [selected, setSelected] = useState<ExerciseId | null>(null);

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

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: { padding: 20, paddingTop: 12, gap: 14, paddingBottom: 24 },
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
