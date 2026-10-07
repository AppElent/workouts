import { useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/data/calendar-day";
import { isRealIsoDate } from "../../src/data/nutrition-weekly-review";
import { DayGoalsScreen } from "../../src/features/nutrition/day-goals/day-goals-screen";

export { ErrorBoundary } from "./nutrition-entry";
export default function NutritionDayGoalsRoute() {
	const { date } = useLocalSearchParams<{ date?: string }>();
	return (
		<DayGoalsScreen
			date={date && isRealIsoDate(date) ? date : todayIsoDate()}
		/>
	);
}
