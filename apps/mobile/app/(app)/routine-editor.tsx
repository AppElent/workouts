import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Platform } from "react-native";
import type { Id } from "../../src/convex/api";
import { RoutineEditorScreen } from "../../src/features/training/routines/routine-editor-screen";
import { useI18n } from "../../src/i18n";

export default function RoutineEditorRoute() {
	const router = useRouter();
	const copy = useI18n().t.workoutTools.routineEditor;
	const { id } = useLocalSearchParams<{ id?: string }>();
	const close = () => router.back();
	return (
		<>
			<RoutineEditorScreen
				routineId={id as Id<"routines"> | undefined}
				onClose={close}
			/>
			{Platform.OS === "ios" ? (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button onPress={close}>
						{copy.cancel}
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
		</>
	);
}
