/**
 * Root of the app.
 *
 * On a cold start, Clerk has to read the session token out of SecureStore and
 * resolve it before it can say whether anyone is signed in — `useAuth()` is
 * `undefined`/loading for the first stretch of that. The native splash stays
 * up (`preventAutoHideAsync`) until Clerk resolves, so the router never
 * mounts a route before it knows which one is right.
 *
 * #46 adds the native chrome the scaffold left out. Three surfaces sit outside
 * React's reach and each will show white on a black app unless told otherwise:
 *
 * 1. expo-router ships react-navigation's **light** theme by default, which
 *    paints the screen background and the header behind every route.
 * 2. The status bar's icons are dark unless the bar is told the app is dark.
 * 3. The window behind the React tree flashes its own background during the
 *    handoff from splash to first frame.
 *
 * Still deliberately missing (an honest gap, not an oversight): the escape
 * hatch for a Clerk that never resolves. On a dead network this holds the
 * splash indefinitely. That belongs with the offline/availability work, not
 * with the shell.
 */
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { publishableKey } from "../src/auth/config";
import { AppConvexProvider } from "../src/convex/provider";
import { LocaleProvider } from "../src/i18n";
import { colors } from "../src/theme";

SplashScreen.preventAutoHideAsync();

/**
 * react-navigation's dark theme, repainted in the app's own palette. Spread
 * first so the `fonts` block (which react-navigation requires and we have no
 * opinion about) survives.
 */
const navigationTheme = {
	...DarkTheme,
	colors: {
		...DarkTheme.colors,
		primary: colors.accent,
		background: colors.bg,
		card: colors.surface,
		text: colors.text,
		border: colors.border,
		notification: colors.accent,
	},
};

export default function RootLayout() {
	return (
		// Gesture handler wraps everything: the pan-driven sheets deeper in the
		// tree need a native root, and it has to be the outermost view to receive
		// touches before React Native's own responder system does.
		<GestureHandlerRootView style={styles.window}>
			{/* Language sits outside Clerk and Convex on purpose. It is a property
			    of this phone rather than of the account, so it has to apply to the
			    sign-in screen, to the offline banner, and to whatever is on screen
			    while the service cannot be reached at all. It also resolves
			    synchronously (see `src/i18n/index.tsx`), so the first frame is
			    already in the right language. */}
			<LocaleProvider>
				<ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
					{/* Convex sits above the router, not below it: the client holds one
					    websocket whose auth follows the session, and it must not be torn
					    down and rebuilt as screens come and go. Signed-out screens simply
					    never query. */}
					<AppConvexProvider>
						<SafeAreaProvider>
							<ThemeProvider value={navigationTheme}>
								<View style={styles.window}>
									<StatusBar style="light" />
									<RootNavigator />
								</View>
							</ThemeProvider>
						</SafeAreaProvider>
					</AppConvexProvider>
				</ClerkProvider>
			</LocaleProvider>
		</GestureHandlerRootView>
	);
}

function RootNavigator() {
	const { isLoaded } = useAuth();

	useEffect(() => {
		if (isLoaded) {
			SplashScreen.hideAsync();
		}
	}, [isLoaded]);

	// Still resolving the cached session. Rendering nothing is the point —
	// the splash is still covering this.
	if (!isLoaded) return null;

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: colors.bg },
			}}
		>
			<Stack.Screen name="(auth)" />
			<Stack.Screen name="(app)" />
		</Stack>
	);
}

const styles = StyleSheet.create({
	window: { flex: 1, backgroundColor: colors.bg },
});
