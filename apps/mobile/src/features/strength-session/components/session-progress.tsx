/** The strip over the exercises: one segment per working set, and volume. */
import { workingVolume } from "@foundry/core";
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { spacing, type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";
import { formatNumber } from "../session-format";
import { allRows } from "../session-plan";
import { useSessionScreen } from "../session-screen-context";

/** Past this many sets the segments would be slivers; one bar reads better. */
const MAX_SEGMENTS = 30;

export function SessionProgress() {
	const { plan } = useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan.now;
	const styles = useThemedStyles(createStyles);
	const rows = allRows(plan).filter((row) => row.kind !== "warmup");
	if (rows.length === 0) return null;
	const done = rows.filter((row) => row.done);
	const next = rows.findIndex((row) => !row.done);
	const volume = workingVolume(
		done.map((row) => ({
			exerciseId: row.exerciseId,
			weight: row.kg,
			unit: "kg" as const,
			reps: row.reps,
			setType: row.kind,
		})),
	);
	const values = { done: done.length, total: rows.length };
	return (
		<View
			style={styles.wrap}
			accessible
			accessibilityLabel={fmt(copy.spokenProgress, values)}
		>
			{rows.length <= MAX_SEGMENTS ? (
				<View style={styles.segments}>
					{rows.map((row, index) => (
						<View
							key={row.id}
							style={[
								styles.segment,
								row.done
									? styles.done
									: index === next
										? styles.next
										: styles.open,
							]}
						/>
					))}
				</View>
			) : (
				<View style={[styles.segment, styles.open]}>
					<View
						style={[
							styles.fill,
							{ width: `${(done.length / rows.length) * 100}%` },
						]}
					/>
				</View>
			)}
			<View style={styles.labels}>
				<AppText variant="label" style={styles.muted}>
					{fmt(copy.progress, values)}
				</AppText>
				{volume > 0 ? (
					<AppText variant="label" style={styles.muted}>
						{fmt(copy.volume, {
							volume: formatNumber(Math.round(volume), locale),
						})}
					</AppText>
				) : null}
			</View>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		wrap: { gap: spacing.sm, paddingHorizontal: spacing.xs },
		segments: { flexDirection: "row", gap: 3 },
		segment: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
		done: { backgroundColor: colors.accentFill },
		fill: { height: 6, borderRadius: 3, backgroundColor: colors.accentFill },
		next: { backgroundColor: colors.accentDim },
		open: { backgroundColor: colors.surface2 },
		labels: { flexDirection: "row", justifyContent: "space-between" },
		muted: { color: colors.textMuted, fontVariant: ["tabular-nums"] },
	});
