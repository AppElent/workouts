import { calcPlates, DEFAULT_BAR, generateWarmup } from "@foundry/core";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
} from "../../../theme";
import { Eyebrow } from "../../../ui/coach";
import { AppText } from "../../../ui/text";

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
	const copy = useI18n().t.workoutTools.plates;
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
					accessibilityLabel={copy.close}
				>
					<AppText variant="body" style={styles.close}>
						{copy.done}
					</AppText>
				</Pressable>
			</View>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				showsVerticalScrollIndicator={false}
			>
				<Eyebrow>{copy.perSide}</Eyebrow>
				{result.belowBar ? (
					<AppText variant="caption">{fmt(copy.belowBar, { bar })}</AppText>
				) : result.perSide.length === 0 ? (
					<AppText variant="caption">{fmt(copy.justBar, { bar })}</AppText>
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
							{fmt(copy.summary, { plates: result.perSide.join(" + "), bar })}
						</AppText>
					</>
				)}
				{result.remainder > 0 ? (
					<AppText variant="caption" style={styles.warn}>
						{fmt(copy.short, { remainder: result.remainder })}
					</AppText>
				) : null}
				{warmup.length > 0 ? (
					<>
						<Eyebrow>{copy.warmup}</Eyebrow>
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
											? copy.emptyBar
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
		plateText: { ...type.micro, fontWeight: "800", color: colors.onAccent },
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
