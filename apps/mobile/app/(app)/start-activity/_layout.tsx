import { Stack } from "expo-router";
import { StartActivityProvider } from "../../../src/features/start-activity/start-activity-flow";
import { useTokens } from "../../../src/theme";
export default function StartActivityLayout() {
	const colors = useTokens();
	return (
		<StartActivityProvider>
			<Stack
				screenOptions={{
					headerTintColor: colors.accent,
					headerBackButtonDisplayMode: "minimal",
					contentStyle: { backgroundColor: colors.bg },
				}}
			/>
		</StartActivityProvider>
	);
}
