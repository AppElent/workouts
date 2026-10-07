import { SymbolView } from "expo-symbols";
import { Pressable, View } from "react-native";
import { spacing, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";
import { NutritionChoiceMenu } from "../../components/nutrition-choice-menu";
import type { NutritionChoiceMenuItem } from "../../components/nutrition-choice-menu-props";

/**
 * A section's title is its menu (`Foods ⌄`), so the actions for that kind sit
 * where the kind is named; an empty section has no menu. In selection mode the
 * right side becomes "All" instead of the count.
 */
export function LibrarySectionHeader({
	title,
	count,
	menuLabel,
	actions,
	onSelect,
	allLabel,
	onToggleAll,
}: {
	title: string;
	count: number;
	menuLabel: string;
	actions?: readonly NutritionChoiceMenuItem[];
	onSelect: (id: string) => void;
	allLabel?: string;
	onToggleAll?: () => void;
}) {
	const colors = useTokens();
	const label = (
		<View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
			<AppText variant="navTitle" style={{ fontWeight: "700" }}>
				{title}
			</AppText>
			{actions ? (
				<SymbolView
					name={{
						ios: "chevron.down",
						android: "expand_more",
						web: "expand_more",
					}}
					size={10}
					weight="bold"
					tintColor={colors.textMuted}
				/>
			) : null}
		</View>
	);
	return (
		<View
			accessibilityRole="header"
			style={{
				flexDirection: "row",
				alignItems: "center",
				marginHorizontal: 20,
				marginTop: spacing.md,
				marginBottom: 6,
				minHeight: 32,
			}}
		>
			<View style={{ flex: 1, alignItems: "flex-start" }}>
				{actions ? (
					<NutritionChoiceMenu
						accessibilityLabel={menuLabel}
						sections={[actions]}
						onSelect={onSelect}
					>
						{label}
					</NutritionChoiceMenu>
				) : (
					label
				)}
			</View>
			{onToggleAll ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${allLabel} ${title}`}
					onPress={onToggleAll}
					hitSlop={8}
				>
					<AppText
						variant="footnote"
						style={{ color: colors.accent, fontWeight: "700" }}
					>
						{allLabel}
					</AppText>
				</Pressable>
			) : (
				<AppText variant="footnote">{count}</AppText>
			)}
		</View>
	);
}
