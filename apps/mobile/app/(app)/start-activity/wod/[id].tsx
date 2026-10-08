import { useRouter } from "expo-router";
import { WodDetailScreen } from "../../../../src/screens/wod-detail";
export default function StartWodDetailRoute() {
	const router = useRouter();
	return (
		<WodDetailScreen
			onEdit={(id) =>
				router.push({ pathname: "/start-activity/wod-editor", params: { id } })
			}
		/>
	);
}
