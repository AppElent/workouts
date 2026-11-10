import { Stack } from "expo-router";
import { EnduranceEditorScreen } from "../../../src/features/training/endurance/endurance-editor-screen";
import { useStartActivity } from "../../../src/features/training/start-activity/start-activity-flow";
import { useI18n } from "../../../src/i18n";
export default function StartEnduranceRoute() {
	const flow = useStartActivity();
	const {
		t: { training: copy },
	} = useI18n();
	return (
		<>
			<Stack.Screen
				options={{
					title: flow.sport === "cycling" ? copy.cycling : copy.running,
				}}
			/>
			<EnduranceEditorScreen
				nativeSheet
				sport={flow.sport === "cycling" ? "cycling" : "running"}
				onCreated={(id) =>
					flow.complete({ pathname: "/endurance/[id]", params: { id } })
				}
			/>
		</>
	);
}
