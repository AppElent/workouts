import { useRouter } from "expo-router";
import { WodDetailScreen } from "../../../src/features/training/wods/wod-detail-screen";

export default function WodDetailRoute() {
	const router = useRouter();
	return (
		<WodDetailScreen
			onEdit={(id) => router.push({ pathname: "/wod-editor", params: { id } })}
		/>
	);
}
