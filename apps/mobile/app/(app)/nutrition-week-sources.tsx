export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

import { NUTRIENT_KEYS } from "@foundry/core";
import { useLocalSearchParams } from "expo-router";
import { WeekSourcesScreen } from "../../src/features/nutrition/week/week-sources-screen";

export default function NutritionWeekSourcesRoute() {
	const { startDate, nutrient } = useLocalSearchParams<{
		startDate?: string;
		nutrient?: string;
	}>();
	return (
		<WeekSourcesScreen
			startDate={startDate}
			nutrient={NUTRIENT_KEYS.find((key) => key === nutrient) ?? "energy"}
		/>
	);
}
