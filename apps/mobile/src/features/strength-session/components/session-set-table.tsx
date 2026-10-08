import { useQueries } from "convex/react";
import { useMemo } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useI18n } from "../../../i18n";
import { radius, spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
import type { SessionSet } from "../data/use-strength-session";

export function SessionSetTable({
	sessionId,
	exerciseId,
	name,
	sets,
	planned,
	busy,
	active,
	onOpen,
}: {
	sessionId: Id<"workoutSessions">;
	exerciseId: string;
	name: string;
	sets: SessionSet[];
	planned: { weight: number; unit: "kg" | "lbs"; reps: number }[];
	busy: boolean;
	active: boolean;
	onOpen: (setId?: Id<"sets">) => void;
}) {
	const {
		locale,
		t: { strength: copy },
	} = useI18n();
	const colors = useTokens();
	const expanded = useWindowDimensions().fontScale > 1.4;
	const query = useMemo(
		() => ({
			previous: {
				query: api.sets.getPreviousForExercise,
				args: { sessionId, exerciseId },
			},
		}),
		[sessionId, exerciseId],
	);
	const result = useQueries(query).previous;
	const previous = Array.isArray(result) ? (result as SessionSet[]) : undefined;
	const format = (value: number) =>
		value.toLocaleString(locale, { maximumFractionDigits: 1 });
	const previousLabel = (number: number) => {
		const set = previous?.find((item) => item.setNumber === number);
		return set
			? `${format(set.weight)} ${set.unit} × ${set.reps}`
			: result === undefined
				? "…"
				: "—";
	};
	const border = {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderColor: colors.separator,
	};
	return (
		<View style={[styles.table, { backgroundColor: colors.surface }]}>
			{!expanded && (
				<View style={styles.row}>
					<AppText variant="footnote" style={styles.number}>
						{copy.set}
					</AppText>
					<AppText variant="footnote" style={styles.previous}>
						{copy.previous}
					</AppText>
					<AppText variant="footnote" style={styles.load}>
						{copy.weight}
					</AppText>
					<AppText
						variant="footnote"
						style={styles.reps}
						accessibilityLabel={copy.reps}
					>
						{copy.repsShort}
					</AppText>
					<View style={styles.mark} />
				</View>
			)}
			{sets.map((set) => (
				<Pressable
					key={set._id}
					accessibilityRole="button"
					accessibilityLabel={`${copy.editSet} ${set.setNumber} ${name}`}
					accessibilityValue={{
						text: `${copy[set.setType]}, ${format(set.weight)} ${set.unit}, ${set.reps} ${copy.reps}${set.rpe === undefined ? "" : `, RPE ${format(set.rpe)}`}, ${copy.logged}`,
					}}
					disabled={busy}
					onPress={() => onOpen(set._id)}
					style={[styles.row, expanded && styles.expanded, border]}
				>
					{expanded ? (
						<>
							<AppText>
								{copy.set} {set.setNumber} · {copy[set.setType]}
							</AppText>
							<AppText>
								{format(set.weight)} {set.unit} × {set.reps} {copy.repsShort} ✓
							</AppText>
							<AppText variant="footnote">
								{copy.previous}: {previousLabel(set.setNumber)}
							</AppText>
						</>
					) : (
						<>
							<AppText style={styles.number}>
								{set.setType === "working"
									? set.setNumber
									: copy[set.setType].slice(0, 1)}
							</AppText>
							<AppText variant="footnote" style={styles.previous}>
								{previousLabel(set.setNumber)}
							</AppText>
							<AppText style={styles.load}>
								{format(set.weight)} {set.unit}
							</AppText>
							<AppText style={styles.reps}>{set.reps}</AppText>
							<AppText style={[styles.mark, { color: colors.accent }]}>
								✓
							</AppText>
						</>
					)}
				</Pressable>
			))}
			{planned
				.map((target, index) => ({ ...target, number: index + 1 }))
				.slice(sets.length)
				.map((target, index) => (
					<Pressable
						key={target.number}
						accessibilityRole="button"
						accessibilityLabel={`${copy.target} ${target.number}, ${format(target.weight)} ${target.unit}, ${target.reps} ${copy.reps}`}
						disabled={!active || busy || index !== 0}
						onPress={() => onOpen()}
						style={[styles.row, expanded && styles.expanded, border]}
					>
						{expanded ? (
							<>
								<AppText variant="footnote">
									{copy.target} {target.number}
								</AppText>
								<AppText variant="footnote">
									{format(target.weight)} {target.unit} × {target.reps}{" "}
									{copy.repsShort}
								</AppText>
								<AppText variant="footnote">
									{copy.previous}: {previousLabel(target.number)}
								</AppText>
							</>
						) : (
							<>
								<AppText variant="footnote" style={styles.number}>
									{target.number}
								</AppText>
								<AppText variant="footnote" style={styles.previous}>
									{previousLabel(target.number)}
								</AppText>
								<AppText variant="footnote" style={styles.load}>
									{format(target.weight)} {target.unit}
								</AppText>
								<AppText variant="footnote" style={styles.reps}>
									{target.reps}
								</AppText>
								<AppText style={styles.mark}>
									{active && index === 0 ? "+" : "—"}
								</AppText>
							</>
						)}
					</Pressable>
				))}
		</View>
	);
}
const styles = StyleSheet.create({
	expanded: { flexDirection: "column", alignItems: "stretch" },
	table: { borderRadius: radius.contentCard, overflow: "hidden" },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		minHeight: 52,
		padding: spacing.sm,
	},
	number: { flex: 0.5 },
	previous: { flex: 1.5 },
	load: { flex: 1.1, textAlign: "right", fontVariant: ["tabular-nums"] },
	reps: { flex: 0.7, textAlign: "right", fontVariant: ["tabular-nums"] },
	mark: { width: 20, textAlign: "right" },
});
