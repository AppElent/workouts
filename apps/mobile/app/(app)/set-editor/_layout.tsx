import { Stack } from "expo-router";
import { useTokens } from "../../../src/theme";
export default function SetEditorLayout() {
	const colors = useTokens();
	return (
		<Stack
			screenOptions={{
				headerTintColor: colors.accent,
				headerBackButtonDisplayMode: "minimal",
				headerShadowVisible: false,
				headerStyle: { backgroundColor: colors.bg },
				contentStyle: { backgroundColor: colors.bg },
			}}
		/>
	);
}
