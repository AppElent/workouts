import { Stack } from "expo-router";
import { Platform } from "react-native";
import { colors } from "../theme";

/** Native navigation chrome shared by the five independent Coach tab stacks. */
export function CoachTabStack({ title }: { title: string }) {
	const ios = Platform.OS === "ios";

	return (
		<Stack
			screenOptions={{
				contentStyle: { backgroundColor: colors.bg },
				headerBackButtonDisplayMode: "minimal",
				headerTintColor: colors.accent,
				gestureEnabled: true,
				...(ios
					? {
							headerBlurEffect: "systemUltraThinMaterialDark" as const,
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
