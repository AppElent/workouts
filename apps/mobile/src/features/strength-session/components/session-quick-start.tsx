/**
 * An empty session starts from what you train most lately (APP-255): one tap
 * adds the exercise with last time's set ready, so ad-hoc logging needs no plan.
 */
import { primaryMuscleGroup } from "@foundry/core";
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

export function SessionQuickStart({ fallback }: { fallback: string }) {
	const { workspace, actions, openEditor } = useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan.now;
	const styles = useThemedStyles(createStyles);
	const records = useQuery(api.oneRepMaxes.listCurrentForUser, {});
	const recent = useMemo(() => {
		const seen = new Set<string>();
		return [...(records ?? [])]
			.sort((a, b) => b.date - a.date)
			.flatMap((record) => {
				const id = record.exerciseId as string;
				const exercise = workspace.catalog.find((item) => item._id === id);
				if (!exercise || seen.has(id)) return [];
				seen.add(id);
				return [exercise];
			})
			.slice(0, QUICK_COUNT);
	}, [records, workspace.catalog]);
	return (
		<View style={styles.wrap}>
			<AppText variant="title" accessibilityRole="header">
				{copy.quickTitle}
			</AppText>
			{recent.length ? (
				<View style={styles.grid}>
					{recent.map((exercise) => {
						const facts = workspace.getFacts(exercise._id);
						const last = facts.last
							? fmt(copy.quickLast, {
									load: formatSetShort(
										{ kg: facts.last.kg, reps: facts.last.reps, unit: "kg" },
										facts,
										locale,
									),
								})
							: copy.quickNew;
						return (
							<Pressable
								key={exercise._id}
								accessibilityRole="button"
								accessibilityLabel={`${exercise.name}, ${last}`}
								disabled={!workspace.online}
								onPress={() =>
									void actions.addExercise(
										exercise._id,
										openEditor,
										exercise.name,
									)
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
					})}
				</View>
			) : (
				<AppText variant="secondary" style={styles.last}>
					{fallback}
				</AppText>
			)}
		</View>
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
