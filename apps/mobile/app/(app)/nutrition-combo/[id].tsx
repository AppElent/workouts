import { useLocalSearchParams } from "expo-router";
import { ComboEditorScreen } from "../../../src/features/nutrition/combo/combo-editor-screen";

export { ErrorBoundary } from "../nutrition-library";

export default function NutritionComboRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <ComboEditorScreen comboId={id ?? ""} />;
}
