import { Stack, useGlobalSearchParams } from "expo-router";
import { useState } from "react";
import { SetEditorProvider } from "../../../src/features/strength-session/set-editor-flow";
import { useTokens } from "../../../src/theme";
export default function SetEditorLayout() {
	const colors = useTokens();
	// Search parameters belong to the leaf on a cold deep link. Capture this
	// presentation's identity before navigating to its parameter-free profile.
	const current = useGlobalSearchParams<{
		sessionId: string;
		exerciseId: string;
		setId?: string;
	}>();
	const [params] = useState(current);
	return (
		<SetEditorProvider params={params}>
			<Stack
				screenOptions={{
					headerTintColor: colors.accent,
					headerBackButtonDisplayMode: "minimal",
					contentStyle: { backgroundColor: colors.bg },
				}}
			/>
		</SetEditorProvider>
	);
}
