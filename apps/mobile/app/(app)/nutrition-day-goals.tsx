export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

import { isRealIsoDate } from "@foundry/core";
import { useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/dates/calendar-day";
import { DayGoalsScreen } from "../../src/features/nutrition/day-goals/day-goals-screen";

export default function NutritionDayGoalsRoute() {
	const { date } = useLocalSearchParams<{ date?: string }>();
	return (
		<DayGoalsScreen
			date={date && isRealIsoDate(date) ? date : todayIsoDate()}
		/>
	);
}
