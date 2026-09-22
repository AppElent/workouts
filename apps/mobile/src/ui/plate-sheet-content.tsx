import { calcPlates, DEFAULT_BAR, generateWarmup } from "@workouts/core";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { radius, spacing, type Tokens, useThemedStyles } from "../theme";
import { Eyebrow } from "./coach";
import { AppText } from "./text";

function plateHeight(weight: number) {
	return Math.max(18, Math.min(56, 18 + weight * 1.5));
}

/** Branded calculator content shared by the native iOS and Android sheets. */
export function PlateSheetContent({
	weight,
	onClose,
}: {
	weight: number;
	onClose: () => void;
}) {
	const styles = useThemedStyles(createStyles);
	const unit = "kg" as const;
	const bar = DEFAULT_BAR[unit];
	const result = calcPlates(weight, bar, unit);
	const warmup = generateWarmup(weight, bar, unit);

	return (
		<>
			<View style={styles.header}>
				<AppText variant="heading">{weight} kg</AppText>
				<Pressable
					onPress={onClose}
					hitSlop={12}
					accessibilityRole="button"
					accessibilityLabel="Close"
				>
					<AppText variant="body" style={styles.close}>
						Done
					</AppText>
				</Pressable>
			</View>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				showsVerticalScrollIndicator={false}
			>
				<Eyebrow>Per side</Eyebrow>
				{result.belowBar ? (
					<AppText variant="caption">
						Below the {bar} kg bar — nothing to load.
					</AppText>
				) : result.perSide.length === 0 ? (
					<AppText variant="caption">Just the {bar} kg bar.</AppText>
				) : (
					<>
						<View style={styles.stack}>
							{result.perSide.map((plate, index) => (
								<View
									// biome-ignore lint/suspicious/noArrayIndexKey: repeated plate values have a fixed order
									key={index}
									style={[styles.plate, { height: plateHeight(plate) }]}
								>
									<AppText style={styles.plateText}>{plate}</AppText>
								</View>
							))}
						</View>
						<AppText variant="caption">
							{result.perSide.join(" + ")} per side, plus the {bar} kg bar.
						</AppText>
					</>
				)}
				{result.remainder > 0 ? (
					<AppText variant="caption" style={styles.warn}>
						{result.remainder} kg short — standard plates cannot make this
						exactly.
					</AppText>
				) : null}
				{warmup.length > 0 ? (
					<>
						<Eyebrow>Warm-up</Eyebrow>
						<View style={styles.warmupList}>
							{warmup.map((set) => (
								<View key={`${set.weight}-${set.reps}`} style={styles.row}>
									<AppText variant="body" style={styles.warmupWeight}>
										{set.weight} kg
									</AppText>
									<AppText variant="caption" style={styles.flex}>
										× {set.reps}
									</AppText>
									<AppText variant="caption">
										{set.pct === null
											? "empty bar"
											: `${Math.round(set.pct * 100)}%`}
									</AppText>
								</View>
							))}
						</View>
					</>
				) : null}
			</ScrollView>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: 44,
		},
		close: { color: colors.accent, fontWeight: "800" },
		stack: {
			flexDirection: "row",
			alignItems: "center",
			gap: 3,
			paddingVertical: spacing.sm,
		},
		plate: {
			width: 26,
			borderRadius: radius.xs,
			backgroundColor: colors.accentFill,
			alignItems: "center",
			justifyContent: "center",
		},
		plateText: { fontSize: 9, fontWeight: "800", color: colors.onAccent },
		warn: { color: colors.warn },
		warmupList: { gap: spacing.xs },
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			backgroundColor: colors.surface2,
			borderRadius: radius.md,
			paddingHorizontal: spacing.sm,
			paddingVertical: spacing.sm,
		},
		warmupWeight: { fontWeight: "800", width: 72 },
		flex: { flex: 1 },
	});
