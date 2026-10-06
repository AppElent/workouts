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
import { InsetList, InsetRow } from "../../../../ui/inset-list";
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
	locale,
	editLabel,
	deleteLabel,
	onToggle,
	onOpenEntry,
	onDeleteEntry,
}: {
	label: string;
	expandLabel: string;
	hint: string;
	open: boolean;
	entries: readonly DiaryEntry[];
	locale: "en" | "nl";
	editLabel: string;
	deleteLabel: string;
	onToggle: () => void;
	onOpenEntry: (entry: DiaryEntry) => void;
	onDeleteEntry: (entry: DiaryEntry) => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const flash = useMealFlash(entries.length);
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
				{label}
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
	// Closed, the bar is a plain card: the native grouped list only earns its
	// place once there are rows to swipe.
	if (!open || !expandable)
		return (
			<View style={styles.wrap}>
				<View style={styles.card}>{header}</View>
			</View>
		);
	return (
		<View style={styles.wrap}>
			<InsetList compact headerContent={header}>
				{entries.map((entry) => (
					<InsetRow
						key={entry.id}
						id={entry.id}
						title={entry.name[locale]}
						secondary={entry.serving[locale]}
						value={energyLabel(entry)}
						onPress={() => onOpenEntry(entry)}
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
					/>
				))}
			</InsetList>
			<AppText variant="caption" style={styles.hint}>
				{hint}
			</AppText>
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

/** Lights the bar briefly when the meal gains an item; Reduce Motion skips it. */
function useMealFlash(count: number) {
	const reduceMotion = useReduceMotion();
	const flash = useRef(new Animated.Value(0)).current;
	const previous = useRef(count);
	useEffect(() => {
		const grew = count > previous.current;
		previous.current = count;
		if (!grew || reduceMotion) return;
		flash.setValue(1);
		Animated.timing(flash, {
			toValue: 0,
			duration: 900,
			useNativeDriver: true,
		}).start();
	}, [count, flash, reduceMotion]);
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
			minHeight: 48,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: 14,
			paddingVertical: spacing.sm,
			overflow: "hidden",
		},
		label: { fontWeight: "700" },
		hint: { paddingHorizontal: spacing.xs },
	});
