import { Stack, useRouter } from "expo-router";
import { WodLibraryScreen } from "../../../src/features/training/wods/wod-library-screen";
import { useI18n } from "../../../src/i18n";

export default function StartWodRoute() {
	const router = useRouter();
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.wods.title }} />
			<WodLibraryScreen
				onOpen={(id) =>
					router.push({ pathname: "/start-activity/wod/[id]", params: { id } })
				}
				onCreate={() => router.push("/start-activity/wod-editor")}
			/>
		</>
	);
}
