/**
 * Non-scrolling screen ground. The native stack owns the top inset and header;
 * this wrapper reserves the home indicator for fixed controls at the bottom.
 */
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

export function Screen({
	children,
	edges = ["bottom"],
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
