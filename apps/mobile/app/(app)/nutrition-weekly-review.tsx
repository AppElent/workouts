export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

import { useLocalSearchParams } from "expo-router";
import { WeekScreen } from "../../src/features/nutrition/week/week-screen";

export default function NutritionWeeklyReviewRoute() {
	const { startDate } = useLocalSearchParams<{ startDate?: string }>();
	return <WeekScreen startDate={startDate} />;
}
