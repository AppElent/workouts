import { useLocalSearchParams } from "expo-router";
import { WeekGoalsScreen } from "../../src/features/nutrition/week/week-goals-screen";

export { ErrorBoundary } from "./nutrition-weekly-review";

export default function NutritionWeekGoalsRoute() {
	const { startDate } = useLocalSearchParams<{ startDate?: string }>();
	return <WeekGoalsScreen startDate={startDate} />;
}
