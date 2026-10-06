import { NUTRIENT_KEYS } from "@workouts/core/nutrition";
import { useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/data/calendar-day";
import { isRealIsoDate } from "../../src/data/nutrition-weekly-review";
import { NutrientSourcesScreen } from "../../src/features/nutrition/nutrient-sources/nutrient-sources-screen";

export { ErrorBoundary } from "./nutrition-entry";
export default function NutrientSourcesRoute() {
	const { date, nutrient } = useLocalSearchParams<{
		date?: string;
		nutrient?: string;
	}>();
	return (
		<NutrientSourcesScreen
			date={date && isRealIsoDate(date) ? date : todayIsoDate()}
			nutrient={NUTRIENT_KEYS.find((n) => n === nutrient) ?? "energy"}
		/>
	);
}
