/**
 * Page ground: the app background plus whatever the notch and home indicator
 * demand. Deliberately not a layout — it sets no padding, no header and no
 * structure, so each shell variant is free to disagree about all three.
 */
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

export function Screen({
	children,
	edges = ["top", "bottom"],
}: {
	children: ReactNode;
	edges?: readonly Edge[];
}) {
	return (
		<View style={styles.root}>
			<SafeAreaView style={styles.root} edges={edges}>
				{children}
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
});
