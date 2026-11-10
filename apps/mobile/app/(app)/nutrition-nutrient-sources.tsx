import { isRealIsoDate, NUTRIENT_KEYS } from "@foundry/core";
import { useLocalSearchParams } from "expo-router";
import { todayIsoDate } from "../../src/dates/calendar-day";
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
