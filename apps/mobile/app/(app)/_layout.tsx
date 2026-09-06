/**
 * The signed-in shell.
 *
 * The guard is Clerk's `isSignedIn`, never Convex's `isAuthenticated`. The two
 * disagree for the length of the JWT handshake right after sign-in, and
 * guarding on the Convex side produces an infinite bounce between this group
 * and `(auth)`.
 *
 * A plain Stack, and it stays one. The tab bar lives in the nested `(coach)`
 * group, which is a screen of this stack — expo-router keeps navigation state
 * per route and crashes if a route's navigator type changes underneath it, so
 * `NativeTabs` gets its own route rather than replacing this one.
 *
 * The chrome (offline banner, active-session bar) is mounted here rather than
 * inside the tab group so it floats over the tabs *and* over anything pushed on
 * top of them. Both absolutely position themselves; the `box-none` wrapper
 * inside each is what stops them swallowing touches meant for the screen.
 */
import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { PersonalFoodsProvider } from "../../src/data/personal-foods";
import { colors } from "../../src/theme";
import { ActiveSessionBar } from "../../src/ui/active-session-bar";
import { ConfirmProvider } from "../../src/ui/confirm-dialog";
import { OfflineBanner } from "../../src/ui/offline-banner";
import { RestTimerProvider } from "../../src/ui/rest-timer";
import { ToastProvider } from "../../src/ui/toast";

export default function AppLayout() {
	const { isSignedIn } = useAuth();

	if (!isSignedIn) {
		return <Redirect href="/sign-in" />;
	}

	return (
		<ToastProvider>
			<ConfirmProvider>
				<RestTimerProvider>
					<PersonalFoodsProvider>
						<View style={{ flex: 1, backgroundColor: colors.bg }}>
							<Stack
								screenOptions={{
									headerShown: false,
									contentStyle: { backgroundColor: colors.bg },
								}}
							/>
							<ActiveSessionBar />
							<OfflineBanner />
						</View>
					</PersonalFoodsProvider>
				</RestTimerProvider>
			</ConfirmProvider>
		</ToastProvider>
	);
}
