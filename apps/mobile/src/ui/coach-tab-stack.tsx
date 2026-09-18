import { Stack } from "expo-router";
import { Platform } from "react-native";
import { colors } from "../theme";
import { isIOS26OrLater } from "./platform";

/**
 * Native navigation chrome shared by the five independent Coach tab stacks.
 *
 * Header colours are the static dark values on purpose. On this device the
 * stack header resolves its trait as *light* while the tab bar resolves dark
 * (iOS 26 + the late `userInterfaceStyle` pin), so a `DynamicColorIOS` here
 * painted the large title in the light scheme's near-black ink onto the dark
 * ground. Until the app ships a real light mode and unpins, the header is
 * simply told the colours the content is using. The tab bar keeps `chrome`
 * because Liquid Glass there genuinely flips with the content under it.
 *
 * The blur is only asked for below iOS 26. From 26 the header is Liquid Glass
 * on its own, and an explicit `headerBlurEffect` is layered above the large
 * title, which then shows as a pale smear where the word should be.
 */
export function CoachTabStack({ title }: { title: string }) {
	const ios = Platform.OS === "ios";

	return (
		<Stack
			screenOptions={{
				// Also the stack-level default: a screen that sets its own options
				// (Nutrition adds a headerRight) must not fall back to the route
				// name "index".
				title,
				contentStyle: { backgroundColor: colors.bg },
				headerBackButtonDisplayMode: "minimal",
				headerTintColor: colors.accent,
				gestureEnabled: true,
				...(ios
					? {
							headerBlurEffect: isIOS26OrLater()
								? undefined
								: ("systemUltraThinMaterial" as const),
							headerLargeTitle: true,
							headerLargeTitleShadowVisible: false,
							headerLargeTitleStyle: { color: colors.text },
							headerShadowVisible: false,
							headerTitleStyle: { color: colors.text },
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
