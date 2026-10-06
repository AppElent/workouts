import { roundForDisplay } from "@workouts/core/nutrition";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import type { DiaryEntry } from "../../../../data/nutrition-day";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { AppText } from "../../../../ui/text";

/**
 * The meal's running total, and what is in it.
 *
 * This is the only confirmation a quick log gets: there is no transient "added
 * to Ontbijt" line any more, so the count and kcal moving here — announced,
 * because it is a polite live region — is the feedback.
 */
export function LogFoodMealSummary({
	label,
	expandLabel,
	emptyLabel,
	open,
	entries,
	locale,
	onToggle,
}: {
	label: string;
	expandLabel: string;
	emptyLabel: string;
	open: boolean;
	entries: readonly DiaryEntry[];
	locale: "en" | "nl";
	onToggle: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.mealSummary}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={expandLabel}
				accessibilityState={{ expanded: open }}
				onPress={onToggle}
				style={styles.mealSummaryHeader}
			>
				<AppText
					accessibilityLiveRegion="polite"
					style={[styles.flex, styles.mealSummaryLabel]}
				>
					{label}
				</AppText>
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
			</Pressable>
			{open ? (
				<View style={styles.mealSummaryBody}>
					{entries.length === 0 ? (
						<AppText variant="caption">{emptyLabel}</AppText>
					) : (
						entries.map((entry) => (
							<View key={entry.id} style={styles.mealSummaryEntry}>
								<AppText variant="caption" style={styles.flex}>
									{entry.name[locale]} · {entry.serving[locale]}
								</AppText>
								<AppText variant="caption" style={styles.tabular}>
									{entry.nutrients.energy.kind === "value"
										? `${roundForDisplay("energy", entry.nutrients.energy.amount)} kcal`
										: entry.nutrients.energy.kind === "trace"
											? "~0 kcal"
											: "— kcal"}
								</AppText>
							</View>
						))
					)}
				</View>
			) : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		flex: { flex: 1 },
		tabular: { fontVariant: ["tabular-nums"] },
		mealSummary: {
			marginHorizontal: spacing.md,
			borderRadius: radius.card,
			borderWidth: 1,
			borderColor: colors.accent,
			backgroundColor: colors.accentDim,
			overflow: "hidden",
		},
		mealSummaryHeader: {
			minHeight: 48,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: 14,
			paddingVertical: spacing.sm,
		},
		mealSummaryLabel: { fontWeight: "700" },
		mealSummaryBody: {
			gap: 6,
			paddingHorizontal: 14,
			paddingBottom: 10,
		},
		mealSummaryEntry: { flexDirection: "row", gap: 10 },
	});
