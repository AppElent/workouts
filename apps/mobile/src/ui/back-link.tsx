/**
 * "‹ Session": a back link that names where it goes (APP-619). A toolbar
 * button with an SF Symbol shows only the symbol and keeps the label for
 * VoiceOver, so screens that need the words put this in a `Stack.Toolbar.View`.
 */
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet } from "react-native";
import { useTokens } from "../theme";
import { AppText } from "./text";

export function BackLink({
	label,
	onPress,
	disabled,
	testID,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	testID?: string;
}) {
	const colors = useTokens();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: Boolean(disabled) }}
			disabled={disabled}
			hitSlop={8}
			onPress={onPress}
			style={({ pressed }) => [
				styles.link,
				(pressed || disabled) && { opacity: disabled ? 0.4 : 0.6 },
			]}
			testID={testID}
		>
			<SymbolView
				name="chevron.left"
				size={18}
				weight="semibold"
				tintColor={colors.accentInk}
			/>
			<AppText variant="body" style={{ color: colors.accentInk }}>
				{label}
			</AppText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	link: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		minHeight: 44,
		paddingHorizontal: 4,
	},
});
