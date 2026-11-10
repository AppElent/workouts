import { useLocalSearchParams } from "expo-router";
import type { Id } from "../../src/convex/api";
import { EnduranceEditorScreen } from "../../src/features/training/endurance/endurance-editor-screen";

export default function EnduranceEditorRoute() {
	const { id, sport } = useLocalSearchParams<{ id?: string; sport?: string }>();
	return (
		<EnduranceEditorScreen
			id={id as Id<"activities"> | undefined}
			sport={sport === "cycling" ? "cycling" : "running"}
		/>
	);
}

export { TrainingRouteError as ErrorBoundary } from "../../src/features/training/components/training-route-error";
