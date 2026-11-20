/**
 * What every Hosted Workout route and join link shows while
 * HOSTED_WORKOUTS_ENABLED is false (APP-437). Join links from other apps,
 * universal links, and pending joins after sign-in all land on `/join/<token>`
 * (`app/+native-intent.tsx`), so they end here too. The route files pick this
 * screen; the hosted screens themselves stay untouched for when the switch
 * flips back.
 */
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { EmptyState } from "../../../ui/empty-state";
import { Screen } from "../../../ui/screen";
import { clearPendingJoin } from "./pending-join";

export function HostedPausedScreen() {
	const router = useRouter();
	const copy = useI18n().t.hosted;
	// A join link opened while signed out is remembered for after sign-in; it
	// has nowhere to go now, so drop it once this screen shows.
	useEffect(clearPendingJoin, []);
	return (
		<Screen>
			<View style={styles.root} testID="hosted-paused">
				<EmptyState
					title={copy.pausedTitle}
					body={copy.pausedBody}
					action={{
						label: copy.pausedAction,
						onPress: () => router.replace("/train"),
					}}
				/>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: spacing.lg,
	},
});
