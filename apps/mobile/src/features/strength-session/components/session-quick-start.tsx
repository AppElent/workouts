/**
 * An empty session starts from what you train most lately (APP-255): one tap
 * adds the exercise with last time's set ready, so ad-hoc logging needs no plan.
 */
import { convertLoad, primaryMuscleGroup } from "@foundry/core";
import type { Exercise } from "@foundry/core/exercises";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";
import { MuscleIcon } from "../../training/exercises/muscle-icon";
import { formatSetShort } from "../session-format";
import { useSessionScreen } from "../session-screen-context";

const QUICK_COUNT = 6;
const RECENT_SESSIONS = 20;

/** Exercise ids from recent finished sessions, newest first, then from records. */
export function recentExerciseIds(
	sessions: readonly {
		status: string;
		exercises?: readonly { exerciseId: string }[];
	}[],
	records: readonly { exerciseId: string; date: number }[],
) {
	const ids: string[] = [];
	const add = (id: string) => {
		if (!ids.includes(id)) ids.push(id);
	};
	for (const session of sessions)
		if (session.status === "completed")
			for (const item of session.exercises ?? []) add(item.exerciseId);
	for (const record of [...records].sort((a, b) => b.date - a.date))
		add(record.exerciseId);
	return ids;
}

export function SessionQuickStart({ fallback }: { fallback: string }) {
	const { workspace } = useSessionScreen();
	const { t } = useI18n();
	const copy = t.strength.plan.now;
	const styles = useThemedStyles(createStyles);
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
				.slice(0, QUICK_COUNT),
		[records, sessions, workspace.catalog],
	);
	return (
		<View style={styles.wrap}>
			<AppText variant="title" accessibilityRole="header">
				{copy.quickTitle}
			</AppText>
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
		? fmt(copy.quickLast, {
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
			<MuscleIcon group={primaryMuscleGroup(exercise)} size={40} />
			<AppText variant="row" numberOfLines={2} style={styles.name}>
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
		wrap: { gap: spacing.md, paddingTop: spacing.md },
		grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
		tile: {
			flexBasis: "47%",
			flexGrow: 1,
			minHeight: 120,
			gap: 4,
			padding: spacing.md - 4,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			backgroundColor: colors.surface,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.border,
		},
		name: { fontWeight: "600" },
		last: { color: colors.textMuted, fontVariant: ["tabular-nums"] },
		dim: { opacity: 0.6 },
	});
