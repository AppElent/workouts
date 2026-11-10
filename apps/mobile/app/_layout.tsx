/**
 * Root of the app.
 *
 * On a cold start, Clerk has to read the session token out of SecureStore and
 * resolve it before it can say whether anyone is signed in — `useAuth()` is
 * `undefined`/loading for the first stretch of that. The native splash stays
 * up (`preventAutoHideAsync`) until Clerk resolves, so the router never
 * mounts a route before it knows which one is right.
 *
 * The splash also waits for the native window color, so navigation, status
 * bar and window appear in the same appearance.
 *
 * Known gap: there is no escape hatch for a Clerk that never resolves; on a
 * dead network this holds the splash indefinitely.
 */
import "../src/observability/sentry";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import * as Sentry from "@sentry/react-native";
import {
	DarkTheme,
	DefaultTheme,
	Stack,
	ThemeProvider,
	useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { publishableKey } from "../src/auth/config";
import { AppConvexProvider } from "../src/convex/provider";
import { LocaleProvider, useI18n } from "../src/i18n";
import { configureFeedbackLanguage } from "../src/observability/sentry";
import { AppearanceProvider, useAppearance, useTokens } from "../src/theme";

SplashScreen.preventAutoHideAsync();

function RootLayout() {
	return (
		<AppearanceProvider>
			<ThemedRoot />
		</AppearanceProvider>
	);
}

export default Sentry.wrap(RootLayout);

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
			{/* Language sits outside Clerk and Convex: it belongs to the phone, not
			    the account (see `src/i18n/index.tsx`). */}
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
	const { isLoaded, userId } = useAuth();
	const screen = useSegments().join("/") || "/";
	const { locale } = useI18n();
	useEffect(() => {
		Sentry.setTag("screen", screen);
	}, [screen]);
	useEffect(() => configureFeedbackLanguage(locale), [locale]);

	useEffect(() => {
		Sentry.setUser(isLoaded && userId ? { id: userId } : null);
		return () => Sentry.setUser(null);
	}, [isLoaded, userId]);

	useEffect(() => {
		if (isLoaded && windowReady) {
			SplashScreen.hideAsync();
		}
	}, [isLoaded, windowReady]);

	// The splash still covers this.
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
