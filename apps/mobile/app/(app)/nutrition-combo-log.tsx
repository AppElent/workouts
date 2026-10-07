/** Logging a saved combo onto a day and meal, as a sheet over where it was chosen. */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { todayIsoDate } from "../../src/data/calendar-day";
import { MEAL_SLOTS } from "../../src/data/nutrition-day";
import { usePersonalFoods } from "../../src/data/personal-foods";
import { ComboLogScreen } from "../../src/features/nutrition/combo/combo-log-screen";

export { ErrorBoundary } from "./nutrition-library";

const leave = () =>
	router.canGoBack() ? router.back() : router.replace("/nutrition");

export default function NutritionComboLogRoute() {
	const { comboId, date, meal } = useLocalSearchParams<{
		comboId?: string;
		date?: string;
		meal?: string;
	}>();
	const library = usePersonalFoods();
	const combo = comboId ? library.findCombo(comboId) : undefined;
	useEffect(() => {
		if (!combo) leave();
	}, [combo]);
	if (!combo) return null;
	return (
		<ComboLogScreen
			combo={combo}
			meal={MEAL_SLOTS.find((slot) => slot === meal) ?? "breakfast"}
			date={date ?? todayIsoDate()}
			onClose={leave}
		/>
	);
}
