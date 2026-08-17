/**
 * Root of the app.
 *
 * On a cold start, Clerk has to read the session token out of SecureStore and
 * resolve it before it can say whether anyone is signed in — `useAuth()` is
 * `undefined`/loading for the first stretch of that. The native splash stays
 * up (`preventAutoHideAsync`) until Clerk resolves, so the router never
 * mounts a route before it knows which one is right.
 *
 * This is a deliberately trimmed version of the cold-start dance: no
 * escape-hatch timeout, no shell/theme/i18n providers layered in — those are
 * other tickets (#46 shell, #49 i18n). If Clerk genuinely can't be reached
 * (dead network), this screen holds the splash indefinitely; that's a real
 * gap the app shell should close, not one this scaffold papers over.
 */
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { publishableKey } from "../src/auth/config";
import { AppConvexProvider } from "../src/convex/provider";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	return (
		<ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
			{/* Convex sits above the router, not below it: the client holds one
			    websocket whose auth follows the session, and it must not be torn
			    down and rebuilt as screens come and go. Signed-out screens simply
			    never query. */}
			<AppConvexProvider>
				<SafeAreaProvider>
					<RootNavigator />
				</SafeAreaProvider>
			</AppConvexProvider>
		</ClerkProvider>
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
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="(auth)" />
			<Stack.Screen name="(app)" />
		</Stack>
	);
}
