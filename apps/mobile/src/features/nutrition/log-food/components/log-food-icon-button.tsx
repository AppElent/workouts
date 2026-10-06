import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet } from "react-native";
import {
	radius,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../../theme";

/** One 40pt square control in the in-content search row. */
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
			hitSlop={4}
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

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
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
