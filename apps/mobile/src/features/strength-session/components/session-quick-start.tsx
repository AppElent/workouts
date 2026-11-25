/**
 * An empty session starts from what you train most lately (APP-255, canvas
 * round 2): one tap adds the exercise with last time's set ready, so ad-hoc
 * logging needs no plan. Each tile says how long ago that set was.
 */
import { convertLoad, primaryMuscleGroup } from "@foundry/core";
import type { Exercise } from "@foundry/core/exercises";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { fmt, plural, useI18n } from "../../../i18n";
import { spacing, type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";
import { MuscleIcon } from "../../training/exercises/muscle-icon";
import { formatSetShort } from "../session-format";
import { useSessionScreen } from "../session-screen-context";
import { useCompactPhone } from "./now-card";

const QUICK_COUNT = 6;
const QUICK_COUNT_COMPACT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days between a logged set and now, in local time. */
export function daysAgo(date: number, now: number) {
	const start = (time: number) => {
		const day = new Date(time);
		day.setHours(0, 0, 0, 0);
		return day.getTime();
	};
	return Math.max(0, Math.round((start(now) - start(date)) / DAY_MS));
}
const RECENT_SESSIONS = 20;

/**
 * Exercise ids from recent finished sessions, most often done first (ties to
 * the newest), then the rest from records, newest first.
 */
export function recentExerciseIds(
	sessions: readonly {
		status: string;
		exercises?: readonly { exerciseId: string }[];
	}[],
	records: readonly { exerciseId: string; date: number }[],
) {
	const counts = new Map<string, number>();
	for (const session of sessions)
		if (session.status === "completed")
			for (const id of new Set(
				(session.exercises ?? []).map((item) => item.exerciseId),
			))
				counts.set(id, (counts.get(id) ?? 0) + 1);
	// Map keeps first-seen order, which is newest first; sort is stable.
	const ids = [...counts.keys()].sort(
		(a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
	);
	for (const record of [...records].sort((a, b) => b.date - a.date))
		if (!ids.includes(record.exerciseId)) ids.push(record.exerciseId);
	return ids;
}

export function SessionQuickStart({ fallback }: { fallback: string }) {
	const { workspace } = useSessionScreen();
	const { t } = useI18n();
	const copy = t.strength.plan.now;
	const styles = useThemedStyles(createStyles);
	const count = useCompactPhone() ? QUICK_COUNT_COMPACT : QUICK_COUNT;
	const sessions = useQuery(api.workoutSessions.listRecent, {
		limit: RECENT_SESSIONS,
	});
	const records = useQuery(api.oneRepMaxes.listCurrentForUser, {});
	const recent = useMemo(
		() =>
			recentExerciseIds(
				(sessions ?? []).map((session) => ({
					status: session.status,
					exercises: session.exercises?.map((item) => ({
						exerciseId: item.exerciseId as string,
					})),
				})),
				(records ?? []).map((record) => ({
					exerciseId: record.exerciseId as string,
					date: record.date,
				})),
			)
				.flatMap((id) => {
					const exercise = workspace.catalog.find((item) => item._id === id);
					return exercise ? [exercise] : [];
				})
				.slice(0, count),
		[count, records, sessions, workspace.catalog],
	);
	return (
		<View style={styles.wrap}>
			<View style={styles.head}>
				<AppText
					variant="metric"
					accessibilityRole="header"
					style={styles.title}
				>
					{copy.quickTitle}
				</AppText>
				{recent.length ? (
					<AppText variant="secondary" style={styles.last}>
						{copy.quickSubtitle}
					</AppText>
				) : null}
			</View>
			{recent.length ? (
				<View style={styles.grid}>
					{recent.map((exercise) => (
						<QuickTile key={exercise._id} exercise={exercise} />
					))}
				</View>
			) : (
				<AppText variant="secondary" style={styles.last}>
					{fallback}
				</AppText>
			)}
		</View>
	);
}

function QuickTile({ exercise }: { exercise: Exercise }) {
	const { workspace, actions, openEditor } = useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan.now;
	const styles = useThemedStyles(createStyles);
	const sessionId = workspace.session?._id;
	const lastSet = useQuery(
		api.sets.getLastForExercise,
		sessionId
			? { exerciseId: exercise._id, excludeSessionId: sessionId }
			: { exerciseId: exercise._id },
	);
	const facts = workspace.getFacts(exercise._id);
	const last = lastSet
		? fmt(copy.quickAge, {
				load: formatSetShort(
					{
						kg: convertLoad(lastSet.weight, lastSet.unit, "kg"),
						typedLbs: lastSet.unit === "lbs" ? lastSet.weight : undefined,
						reps: lastSet.reps,
						unit: lastSet.unit,
					},
					facts,
					locale,
				),
				age: (() => {
					const days = daysAgo(lastSet.loggedAt, Date.now());
					return days === 0 ? copy.today : plural(locale, days, copy.days);
				})(),
			})
		: copy.quickNew;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${exercise.name}, ${last}`}
			disabled={!workspace.online}
			onPress={() =>
				void actions.addExercise(exercise._id, openEditor, exercise.name)
			}
			style={({ pressed }) => [
				styles.tile,
				(pressed || !workspace.online) && styles.dim,
			]}
			testID="session-quick-exercise"
		>
			<View style={styles.icon}>
				<MuscleIcon group={primaryMuscleGroup(exercise)} size={46} />
			</View>
			<AppText variant="control" numberOfLines={2} style={styles.name}>
				{exercise.name}
			</AppText>
			<AppText variant="caption" style={styles.last}>
				{last}
			</AppText>
		</Pressable>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		wrap: { gap: 14, paddingTop: spacing.sm },
		head: { gap: spacing.xs, paddingHorizontal: spacing.xs },
		title: { letterSpacing: -0.6 },
		grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
		tile: {
			flexBasis: "47%",
			flexGrow: 1,
			minHeight: 128,
			gap: spacing.sm,
			padding: 12,
			borderRadius: 20,
			borderCurve: "continuous",
			backgroundColor: colors.surface,
			borderWidth: 1,
			borderColor: colors.border,
		},
		icon: {
			width: 52,
			height: 52,
			borderRadius: 14,
			borderCurve: "continuous",
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface2,
		},
		name: { fontWeight: "700", letterSpacing: -0.2 },
		last: { color: colors.textMuted, fontVariant: ["tabular-nums"] },
		dim: { opacity: 0.6 },
	});
