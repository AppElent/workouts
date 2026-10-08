import { Stack, useRouter } from "expo-router";
import { WodsScreen } from "../../../src/screens/wods-list";
export default function StartWodRoute() {
	const router = useRouter();
	return (
		<>
			<Stack.Screen options={{ title: "WODs" }} />
			<WodsScreen
				onOpen={(id) =>
					router.push({ pathname: "/start-activity/wod/[id]", params: { id } })
				}
				onCreate={() => router.push("/start-activity/wod-editor")}
			/>
		</>
	);
}
