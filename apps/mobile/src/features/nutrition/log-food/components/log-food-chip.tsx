import { Pressable, StyleSheet } from "react-native";
import { radius, type Tokens, type, useThemedStyles } from "../../../../theme";
import { AppText } from "../../../../ui/text";

/**
 * A scope chip. Scopes read as tabs over one list: they narrow what is shown,
 * they never change where a log goes — that is the title menu's job.
 */
export function LogFoodChip({
	label,
	selected,
	onPress,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole="tab"
			accessibilityState={{ selected }}
			onPress={onPress}
			style={[styles.chip, selected && styles.chipSelected]}
		>
			<AppText style={[styles.chipText, selected && styles.chipTextSelected]}>
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
		chipSelected: { backgroundColor: colors.accentFill },
		chipText: { fontSize: type.footnote.fontSize, color: colors.text },
		chipTextSelected: { color: colors.onAccent, fontWeight: "700" },
	});
