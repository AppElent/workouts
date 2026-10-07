import { Pressable, StyleSheet } from "react-native";
import { radius, type Tokens, type, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";

/**
 * A scope chip. Scopes read as tabs over one list: they narrow what is shown,
 * they never change where a log goes — that is the title menu's job.
 */
export function NutritionScopeChip({
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
			// A compact chip with a 44pt target.
			hitSlop={{ top: 6, bottom: 6 }}
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
		// Design `.chipsrow span`: white pills; the selected one is inked.
		chip: {
			minHeight: 32,
			justifyContent: "center",
			paddingHorizontal: 13,
			borderRadius: radius.pill,
			backgroundColor: colors.surface,
		},
		chipSelected: { backgroundColor: colors.text },
		chipText: {
			fontSize: type.footnote.fontSize,
			fontWeight: "600",
			color: colors.text,
		},
		chipTextSelected: { color: colors.bg },
	});
