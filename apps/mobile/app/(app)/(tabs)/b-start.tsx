/**
 * PROTOTYPE — #46, variant B only.
 *
 * A route that exists so a tab can point at it, and which is never rendered:
 * its `NativeTabs.Trigger` is `disabled`, so the bar draws the item, emits
 * `tabPress`, and skips navigation. The listener in `(tabs)/_layout.tsx` turns
 * that press into a push to `/session`.
 *
 * If you ever see this screen, the verb-tab trick has broken.
 */
import { StyleSheet, View } from "react-native";
import { spacing } from "../../../src/theme";
import { Screen } from "../../../src/ui/screen";
import { AppText } from "../../../src/ui/text";

export default function BStart() {
	return (
		<Screen>
			<View style={styles.root}>
				<AppText variant="caption">
					Unreachable by design — the Start tab is a verb, not a destination.
				</AppText>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: spacing.lg,
	},
});
