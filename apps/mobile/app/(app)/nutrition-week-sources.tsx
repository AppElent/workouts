import { NUTRIENT_KEYS } from "@workouts/core/nutrition";
import { useLocalSearchParams } from "expo-router";
import { WeekSourcesScreen } from "../../src/features/nutrition/week/week-sources-screen";

export { ErrorBoundary } from "./nutrition-weekly-review";

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
