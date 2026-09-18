import { Stack } from "expo-router";
import { Platform } from "react-native";
import { chrome, colors } from "../theme";

/**
 * Native navigation chrome shared by the five independent Coach tab stacks.
 *
 * Header colours come from `chrome`, not `colors`: on iOS 26 the header's
 * trait is the system's call, and a static colour paints the large title
 * invisible when the trait and the pin disagree. The material is the
 * unsuffixed one for the same reason — it follows the trait instead of
 * asserting one.
 */
export function CoachTabStack({ title }: { title: string }) {
	const ios = Platform.OS === "ios";

	return (
		<Stack
			screenOptions={{
				contentStyle: { backgroundColor: colors.bg },
				headerBackButtonDisplayMode: "minimal",
				headerTintColor: chrome.accentInk,
				gestureEnabled: true,
				...(ios
					? {
							headerBlurEffect: "systemUltraThinMaterial" as const,
							headerLargeTitle: true,
							headerLargeTitleShadowVisible: false,
							headerLargeTitleStyle: { color: chrome.text },
							headerShadowVisible: false,
							headerTitleStyle: { color: chrome.text },
							headerTransparent: true,
						}
					: {
							headerShadowVisible: false,
							headerStyle: { backgroundColor: colors.bg },
							headerTitleStyle: { color: colors.text },
						}),
			}}
		>
			<Stack.Screen name="index" options={{ title }} />
		</Stack>
	);
}
