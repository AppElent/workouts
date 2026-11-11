export { NutritionRouteError as ErrorBoundary } from "../../../src/features/nutrition/components/nutrition-route-error";

import { useLocalSearchParams } from "expo-router";
import { ComboEditorScreen } from "../../../src/features/nutrition/combo/combo-editor-screen";

export default function NutritionComboRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <ComboEditorScreen comboId={id ?? ""} />;
}
