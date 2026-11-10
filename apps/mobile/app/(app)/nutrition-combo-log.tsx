export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

/** Logging a saved combo onto a day and meal, as a sheet over where it was chosen. */
import { MEAL_SLOTS, mealSlotAt } from "@foundry/core";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { usePersonalFoods } from "../../src/data/personal-foods";
import { todayIsoDate } from "../../src/dates/calendar-day";
import { ComboLogScreen } from "../../src/features/nutrition/combo/combo-log-screen";

const leave = () =>
	router.canGoBack() ? router.back() : router.replace("/nutrition");

export default function NutritionComboLogRoute() {
	const { comboId, date, meal } = useLocalSearchParams<{
		comboId?: string;
		date?: string;
		meal?: string;
	}>();
	const library = usePersonalFoods({ ids: comboId ? [comboId] : [] });
	const combo = comboId ? library.findCombo(comboId) : undefined;
	useEffect(() => {
		if (!combo && !library.loading) leave();
	}, [combo, library.loading]);
	if (!combo) return null;
	return (
		<ComboLogScreen
			combo={combo}
			meal={MEAL_SLOTS.find((slot) => slot === meal) ?? mealSlotAt(new Date())}
			date={date ?? todayIsoDate()}
			onClose={leave}
		/>
	);
}
