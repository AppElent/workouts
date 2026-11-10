import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Platform } from "react-native";
import type { Id } from "../../src/convex/api";
import { WodEditorScreen } from "../../src/features/training/wods/wod-editor-screen";
import { useI18n } from "../../src/i18n";

export default function WodEditorRoute() {
	const router = useRouter();
	const copy = useI18n().t.wods;
	const { id } = useLocalSearchParams<{ id?: string }>();
	const close = () => router.back();
	return (
		<>
			<WodEditorScreen wodId={id as Id<"wods"> | undefined} onClose={close} />
			{Platform.OS === "ios" ? (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button onPress={close}>
						{copy.editor.cancel}
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
		</>
	);
}
