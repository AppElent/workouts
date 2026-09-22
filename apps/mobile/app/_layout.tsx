/**
 * Root of the app.
 *
 * On a cold start, Clerk has to read the session token out of SecureStore and
 * resolve it before it can say whether anyone is signed in — `useAuth()` is
 * `undefined`/loading for the first stretch of that. The native splash stays
 * up (`preventAutoHideAsync`) until Clerk resolves, so the router never
 * mounts a route before it knows which one is right.
 *
 * Navigation, status bar and the native window resolve the same appearance.
 * Keep the splash visible until auth and the initial window color are ready.
 *
 * Still deliberately missing (an honest gap, not an oversight): the escape
 * hatch for a Clerk that never resolves. On a dead network this holds the
 * splash indefinitely. That belongs with the offline/availability work, not
 * with the shell.
 */
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { publishableKey } from "../src/auth/config";
import { AppConvexProvider } from "../src/convex/provider";
import { LocaleProvider } from "../src/i18n";
import { AppearanceProvider, useAppearance, useTokens } from "../src/theme";

SplashScreen.preventAutoHideAsync();

/**
 * react-navigation's dark theme, repainted in the app's own palette. Spread
 * first so the `fonts` block (which react-navigation requires and we have no
 * opinion about) survives.
 */
export default function RootLayout() {
	return (
		<AppearanceProvider>
			<ThemedRoot />
		</AppearanceProvider>
	);
}

function ThemedRoot() {
	const { scheme, colors } = useAppearance();
	const [windowReady, setWindowReady] = useState(false);
	const baseTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
	const styles = { window: { flex: 1, backgroundColor: colors.bg } };
	useEffect(() => {
		let active = true;
		SystemUI.setBackgroundColorAsync(colors.bg)
			.catch(() => {
				// React's root still paints the background if the OS rejects it.
			})
			.finally(() => {
				if (active) setWindowReady(true);
			});
		return () => {
			active = false;
		};
	}, [colors.bg]);
	const navigationTheme = {
		...baseTheme,
		colors: {
			...baseTheme.colors,
			primary: colors.accent,
			background: colors.bg,
			card: colors.surface,
			text: colors.text,
			border: colors.border,
			notification: colors.accent,
		},
	};

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
									<StatusBar style={scheme === "dark" ? "light" : "dark"} />
									<RootNavigator windowReady={windowReady} />
								</View>
							</ThemeProvider>
						</SafeAreaProvider>
					</AppConvexProvider>
				</ClerkProvider>
			</LocaleProvider>
		</GestureHandlerRootView>
	);
}

function RootNavigator({ windowReady }: { windowReady: boolean }) {
	const colors = useTokens();
	const { isLoaded } = useAuth();

	useEffect(() => {
		if (isLoaded && windowReady) {
			SplashScreen.hideAsync();
		}
	}, [isLoaded, windowReady]);

	// Still resolving the cached session. Rendering nothing is the point —
	// the splash is still covering this.
	if (!isLoaded || !windowReady) return null;

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
