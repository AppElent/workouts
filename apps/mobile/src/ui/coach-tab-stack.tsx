import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useTokens } from "../theme";
import { isIOS26OrLater } from "./platform";

/**
 * Native navigation chrome shared by the five independent Coach tab stacks.
 *
 * Headers use the same resolved palette as their content, including explicit
 * Light/Dark overrides. The tab bar keeps UIKit trait-adaptive chrome because
 * Liquid Glass can choose a different trait from the content beneath it.
 *
 * The blur is only asked for below iOS 26. From 26 the header is Liquid Glass
 * on its own, and an explicit `headerBlurEffect` is layered above the large
 * title, which then shows as a pale smear where the word should be.
 */
export function CoachTabStack({ title }: { title: string }) {
	const colors = useTokens();
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
