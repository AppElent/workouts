export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

import { useLocalSearchParams } from "expo-router";
import { WeekGoalsScreen } from "../../src/features/nutrition/week/week-goals-screen";

export default function NutritionWeekGoalsRoute() {
	const { startDate } = useLocalSearchParams<{ startDate?: string }>();
	return <WeekGoalsScreen startDate={startDate} />;
}
