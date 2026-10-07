/** A saved combo part in the amount editor; each confirmed change is written at once. */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ComboPartScreen } from "../../src/features/nutrition/combo/combo-part-screen";

export { ErrorBoundary } from "./nutrition-library";

const leave = () =>
	router.canGoBack() ? router.back() : router.replace("/nutrition-library");

export default function NutritionComboPartRoute() {
	const { comboId, partId } = useLocalSearchParams<{
		comboId?: string;
		partId?: string;
	}>();
	const valid = Boolean(comboId && partId);
	useEffect(() => {
		if (!valid) leave();
	}, [valid]);
	if (!comboId || !partId) return null;
	return <ComboPartScreen comboId={comboId} partId={partId} onClose={leave} />;
}
