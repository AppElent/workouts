import { StyleSheet, View } from "react-native";
import { type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";

/** What an editor shows while the thing it edits loads or can't be found. */
export function EditorStatus({ label }: { label: string }) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.status}>
			<AppText variant="caption">{label}</AppText>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		status: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.bg,
		},
	});
