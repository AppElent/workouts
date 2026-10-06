import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet } from "react-native";
import {
	radius,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { AppText } from "../../../../ui/text";

/** One 40pt square control in the search row. */
export function LogFoodIconButton({
	label,
	symbol,
	onPress,
	accented = false,
}: {
	label: string;
	symbol: ComponentProps<typeof SymbolView>["name"];
	onPress: () => void;
	accented?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={[styles.iconButton, accented && styles.iconButtonAccented]}
		>
			<SymbolView
				name={symbol}
				size={accented ? 18 : 19}
				tintColor={accented ? colors.accentInk : colors.text}
			/>
		</Pressable>
	);
}

/**
 * A meal chip, and a scope chip at `size="small"`.
 *
 * Meals are a radio set — exactly one is the target you are logging into —
 * while scopes read as tabs over one list, which is why the role differs.
 */
export function LogFoodChip({
	label,
	selected,
	onPress,
	role,
	size = "small",
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
	role: "radio" | "tab";
	size?: "small" | "large";
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole={role}
			accessibilityState={
				role === "radio" ? { checked: selected } : { selected }
			}
			onPress={onPress}
			style={[
				size === "large" ? styles.chipLarge : styles.chip,
				selected && styles.chipSelected,
			]}
		>
			<AppText
				style={[
					size === "large" ? styles.chipLargeText : styles.chipText,
					selected && styles.chipTextSelected,
				]}
			>
				{label}
			</AppText>
		</Pressable>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		chip: {
			minHeight: 32,
			justifyContent: "center",
			paddingHorizontal: 12,
			borderRadius: radius.pill,
			backgroundColor: colors.surface2,
		},
		chipLarge: {
			minHeight: 36,
			justifyContent: "center",
			paddingHorizontal: 14,
			borderRadius: radius.pill,
			backgroundColor: colors.surface2,
		},
		chipSelected: { backgroundColor: colors.accentFill },
		chipText: { fontSize: type.footnote.fontSize, color: colors.text },
		chipLargeText: { fontSize: type.secondary.fontSize, color: colors.text },
		chipTextSelected: { color: colors.onAccent, fontWeight: "700" },
		iconButton: {
			width: 40,
			height: 40,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		iconButtonAccented: {
			backgroundColor: colors.accentDim,
			borderWidth: 1,
			borderColor: colors.accent,
		},
	});
