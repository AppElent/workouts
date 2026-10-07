import { StyleSheet, View } from "react-native";
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
			<AppText variant="navTitle" style={styles.title}>
				{title}
			</AppText>
			{detail ? <AppText variant="footnote">{detail}</AppText> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 8,
		marginHorizontal: 20,
		marginTop: 20,
		marginBottom: 7,
	},
	title: { flex: 1, fontWeight: "700" },
});
