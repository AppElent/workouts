export { NutritionRouteError as ErrorBoundary } from "../../src/features/nutrition/components/nutrition-route-error";

/** Logging a saved combo onto a day and meal, as a sheet over where it was chosen. */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { usePersonalFoods } from "../../src/data/personal-foods";
import { ComboLogScreen } from "../../src/features/nutrition/combo/combo-log-screen";
import { diaryRouteParams } from "../../src/features/nutrition/diary-route-params";

const leave = () =>
	router.canGoBack() ? router.back() : router.replace("/nutrition");

export default function NutritionComboLogRoute() {
	const params = useLocalSearchParams<{
		comboId?: string;
		date?: string;
		meal?: string;
	}>();
	const { comboId } = params;
	const { date, meal } = diaryRouteParams(params);
	const library = usePersonalFoods({ ids: comboId ? [comboId] : [] });
	const combo = comboId ? library.findCombo(comboId) : undefined;
	useEffect(() => {
		if (!combo && !library.loading) leave();
	}, [combo, library.loading]);
	if (!combo) return null;
	return (
		<ComboLogScreen combo={combo} meal={meal} date={date} onClose={leave} />
	);
}
