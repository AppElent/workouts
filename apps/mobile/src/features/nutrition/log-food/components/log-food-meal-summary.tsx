import { roundForDisplay } from "@workouts/core/nutrition";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import type { DiaryEntry } from "../../../../data/nutrition-day";
import { useReduceMotion } from "../../../../feedback/reduce-motion";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { SwipeableRow } from "../../../../ui/swipeable-row";
import { AppText } from "../../../../ui/text";

/**
 * The destination meal's running total, and what is in it.
 *
 * A quick log confirms here as well as in the toast: the count and kcal move,
 * the bar lights up briefly, and the label is a polite live region so the
 * change is announced. Expanded, the logged items use the diary's row
 * contract — tap opens the entry editor, swipe offers edit and delete — so a
 * mistake is fixed without going back to the diary.
 */
export function LogFoodMealSummary({
	label,
	expandLabel,
	hint,
	open,
	entries,
	flashKey,
	locale,
	editLabel,
	deleteLabel,
	closeMenuLabel,
	onToggle,
	onOpenEntry,
	onDeleteEntry,
}: {
	label: string;
	expandLabel: string;
	hint: string;
	open: boolean;
	entries: readonly DiaryEntry[];
	/** Changes once per quick add; the bar lights up when it does. */
	flashKey: number;
	locale: "en" | "nl";
	editLabel: string;
	deleteLabel: string;
	closeMenuLabel: string;
	onToggle: () => void;
	onOpenEntry: (entry: DiaryEntry) => void;
	onDeleteEntry: (entry: DiaryEntry) => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const flash = useMealFlash(flashKey);
	const expandable = entries.length > 0;
	const header = (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={expandable ? expandLabel : undefined}
			accessibilityState={expandable ? { expanded: open } : undefined}
			disabled={!expandable}
			onPress={onToggle}
			style={styles.header}
		>
			<Animated.View
				pointerEvents="none"
				style={[
					StyleSheet.absoluteFill,
					{ backgroundColor: colors.accentDim, opacity: flash },
				]}
			/>
			<AppText
				accessibilityLiveRegion="polite"
				style={[styles.flex, styles.label]}
			>
				{/* Design `.mealbar`: the meal in bold, the tally in regular. */}
				<AppText style={styles.meal}>{label.split(" · ")[0]}</AppText>
				{label.includes(" · ")
					? ` · ${label.split(" · ").slice(1).join(" · ")}`
					: ""}
			</AppText>
			{expandable ? (
				<SymbolView
					name={
						open
							? {
									ios: "chevron.up",
									android: "expand_less",
									web: "expand_less",
								}
							: {
									ios: "chevron.down",
									android: "expand_more",
									web: "expand_more",
								}
					}
					size={15}
					tintColor={colors.accentInk}
				/>
			) : null}
		</Pressable>
	);
	return (
		<View style={styles.wrap}>
			<View style={styles.card}>
				{header}
				{open && expandable
					? entries.map((entry) => (
							<View key={entry.id} style={styles.entry}>
								<View style={styles.separator} />
								<SwipeableRow
									menuTitle={entry.name[locale]}
									closeMenuLabel={closeMenuLabel}
									actions={[
										{
											key: "edit",
											systemImage: "pencil",
											label: editLabel,
											onPress: () => onOpenEntry(entry),
										},
										{
											key: "delete",
											systemImage: "trash",
											label: deleteLabel,
											destructive: true,
											onPress: () => onDeleteEntry(entry),
										},
									]}
								>
									{(accessibility) => (
										<Pressable
											accessibilityRole="button"
											accessibilityActions={accessibility.accessibilityActions}
											onAccessibilityAction={
												accessibility.onAccessibilityAction
											}
											onLongPress={accessibility.onLongPress}
											onPress={() => onOpenEntry(entry)}
											style={({ pressed }) => [
												styles.row,
												pressed && styles.pressed,
											]}
										>
											<View style={styles.flex}>
												<AppText numberOfLines={2} style={styles.title}>
													{entry.name[locale]}
												</AppText>
												<AppText variant="caption" numberOfLines={1}>
													{entry.serving[locale]}
												</AppText>
											</View>
											<AppText variant="footnote" style={styles.value}>
												{energyLabel(entry)}
											</AppText>
										</Pressable>
									)}
								</SwipeableRow>
							</View>
						))
					: null}
			</View>
			{open && expandable ? (
				<AppText variant="caption" style={styles.hint}>
					{hint}
				</AppText>
			) : null}
		</View>
	);
}

function energyLabel(entry: DiaryEntry): string {
	const energy = entry.nutrients.energy;
	return energy.kind === "value"
		? `${roundForDisplay("energy", energy.amount)} kcal`
		: energy.kind === "trace"
			? "~0 kcal"
			: "— kcal";
}

/** Lights the bar briefly after a quick add; Reduce Motion skips it. */
function useMealFlash(flashKey: number) {
	const reduceMotion = useReduceMotion();
	const flash = useRef(new Animated.Value(0)).current;
	const previous = useRef(flashKey);
	useEffect(() => {
		const changed = flashKey !== previous.current;
		previous.current = flashKey;
		if (!changed || reduceMotion) return;
		flash.setValue(1);
		Animated.timing(flash, {
			toValue: 0,
			duration: 900,
			useNativeDriver: true,
		}).start();
	}, [flashKey, flash, reduceMotion]);
	return flash;
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		wrap: { marginHorizontal: spacing.md, gap: spacing.xs },
		card: {
			borderRadius: radius.contentCard,
			backgroundColor: colors.surface,
			overflow: "hidden",
		},
		// Grow without a zero basis: text measured at zero width wraps per word
		// and leaves the bar taller than its one line.
		flex: { flexGrow: 1, flexShrink: 1 },
		header: {
			minHeight: 44,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.sm,
			overflow: "hidden",
		},
		label: { fontWeight: "400" },
		meal: { fontWeight: "600" },
		hint: { paddingHorizontal: spacing.xs },
		entry: { backgroundColor: colors.surface },
		separator: {
			height: StyleSheet.hairlineWidth,
			marginLeft: spacing.md,
			backgroundColor: colors.separator,
		},
		row: {
			minHeight: 52,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: spacing.md,
			paddingVertical: 10,
			backgroundColor: colors.surface,
		},
		pressed: { backgroundColor: colors.surface2 },
		title: { fontWeight: "500" },
		value: { fontVariant: ["tabular-nums"] },
	});
