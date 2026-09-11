/**
 * What to hang on the bar, and how to work up to it. Ported from the web's
 * `src/components/session/PlateSheet.tsx`.
 *
 * The maths is not reimplemented — `calcPlates`, `generateWarmup` and
 * `DEFAULT_BAR` come from `@workouts/core`, the same functions the web calls.
 * They moved there from `src/lib/plates.ts` when this screen was written, so
 * that a plate breakdown cannot disagree between the two clients.
 *
 * Pure presentation: nothing here mutates. The plate stack is drawn with plain
 * Views sized by plate weight, so it needs no SVG.
 */
import { calcPlates, DEFAULT_BAR, generateWarmup } from "@workouts/core";
import {
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { colors, radius, spacing } from "../theme";
import { Eyebrow } from "./coach";
import { AppText } from "./text";

/** Plate widths, scaled so a 25 reads as visibly bigger than a 1.25. */
function plateHeight(weight: number) {
	return Math.max(18, Math.min(56, 18 + weight * 1.5));
}

export function PlateSheet({
	visible,
	weight,
	onClose,
}: {
	visible: boolean;
	weight: number;
	onClose: () => void;
}) {
	const insets = useSafeAreaInsets();
	const reduceMotion = useReduceMotion();
	// Only kg is offered anywhere in the app today — `sets.add` hardcodes it and
	// so does `routines.startSession`. When a unit preference exists, it threads
	// through here.
	const unit = "kg" as const;
	const bar = DEFAULT_BAR[unit];
	const result = calcPlates(weight, bar, unit);
	const warmup = generateWarmup(weight, bar, unit);

	return (
		<Modal
			visible={visible}
			transparent={Platform.OS !== "ios"}
			presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"}
			allowSwipeDismissal
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onClose}
		>
			<Pressable
				style={[
					styles.backdrop,
					Platform.OS === "ios" && {
						backgroundColor: colors.bg,
						justifyContent: "flex-start",
					},
				]}
				onPress={onClose}
			>
				<Pressable
					style={[
						styles.sheet,
						{ paddingBottom: insets.bottom + spacing.lg },
						Platform.OS === "ios" && { flex: 1, borderRadius: 0 },
					]}
					onPress={() => {}}
				>
					{Platform.OS !== "ios" ? <View style={styles.grabber} /> : null}

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
						automaticallyAdjustKeyboardInsets
						keyboardDismissMode="interactive"
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
									{result.perSide.map((plate, i) => (
										<View
											// Plates repeat by design (two 20s a side); the index is
											// what distinguishes them and the order never shifts.
											// biome-ignore lint/suspicious/noArrayIndexKey: repeated values, fixed order
											key={i}
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
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		justifyContent: "flex-end",
		backgroundColor: "rgba(0, 0, 0, 0.6)",
	},
	sheet: {
		maxHeight: "80%",
		gap: spacing.sm,
		backgroundColor: colors.surface,
		borderTopLeftRadius: radius.sheet,
		borderTopRightRadius: radius.sheet,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
	},
	grabber: {
		alignSelf: "center",
		width: 36,
		height: 4,
		borderRadius: radius.pill,
		backgroundColor: colors.borderStrong,
	},
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
		backgroundColor: colors.accent,
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
