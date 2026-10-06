import { StyleSheet, View } from "react-native";
import { spacing } from "../../../../theme";
import { AppText } from "../../../../ui/text";

/** A results section's name, with its count or scope on the right. */
export function LogFoodSectionHeader({
	title,
	detail,
}: {
	title: string;
	detail?: string;
}) {
	return (
		<View accessibilityRole="header" style={styles.row}>
			<AppText variant="label" style={styles.title}>
				{title}
			</AppText>
			{detail ? <AppText variant="caption">{detail}</AppText> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
		paddingBottom: spacing.xs,
	},
	title: { flex: 1 },
});
