import { Stack, useLocalSearchParams } from "expo-router";
import type { Id } from "../../../src/convex/api";
import { EnduranceDetailScreen } from "../../../src/features/training/endurance/endurance-detail-screen";
import { useI18n } from "../../../src/i18n";

export default function EnduranceDetailRoute() {
	const { id } = useLocalSearchParams<{ id?: string }>();
	const copy = useI18n().t.endurance;
	return (
		<>
			<Stack.Screen options={{ title: copy.details }} />
			<EnduranceDetailScreen id={id as Id<"activities"> | undefined} />
		</>
	);
}

export { TrainingRouteError as ErrorBoundary } from "../../../src/features/training/components/training-route-error";
