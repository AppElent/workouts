import { useRouter } from "expo-router";
import { WodDetailScreen } from "../../../../src/features/training/wods/wod-detail-screen";
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
