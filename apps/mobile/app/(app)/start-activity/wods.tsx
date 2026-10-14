import { Stack, useRouter } from "expo-router";
import { useI18n } from "../../../src/i18n";
import { WodsScreen } from "../../../src/screens/wods-list";

export default function StartWodRoute() {
	const router = useRouter();
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.wods.title }} />
			<WodsScreen
				onOpen={(id) =>
					router.push({ pathname: "/start-activity/wod/[id]", params: { id } })
				}
				onCreate={() => router.push("/start-activity/wod-editor")}
			/>
		</>
	);
}
