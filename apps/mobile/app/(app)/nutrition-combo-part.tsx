/** A saved combo part in the amount editor; each confirmed change is written at once. */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import type { ComboPartDraft } from "../../src/data/personal-food-repository";
import { usePersonalFoods } from "../../src/data/personal-foods";
import { ComboPartEditor } from "../../src/features/nutrition/combo/combo-part-editor";
import {
	comboDraft,
	comboTotals,
} from "../../src/features/nutrition/combo/combo-parts";
import { useI18n } from "../../src/i18n";
import { useToast } from "../../src/ui/toast";

export { ErrorBoundary } from "./nutrition-library";

const leave = () =>
	router.canGoBack() ? router.back() : router.replace("/nutrition-library");

export default function NutritionComboPartRoute() {
	const { comboId, partId } = useLocalSearchParams<{
		comboId: string;
		partId: string;
	}>();
	const { t } = useI18n();
	const toast = useToast();
	const library = usePersonalFoods();
	const combo = comboId ? library.findCombo(comboId) : undefined;
	const part = combo?.parts.find((item) => item.id === partId);
	useEffect(() => {
		if (!part) leave();
	}, [part]);
	if (!combo || !part) return null;
	const partEnergy =
		part.snapshot.nutrients.energy.kind === "value"
			? part.snapshot.nutrients.energy.amount
			: 0;
	const write = (parts: readonly ComboPartDraft[]) => {
		try {
			library.updateCombo(combo.id, { name: combo.name, parts });
			leave();
		} catch {
			toast.error(t.nutrition.comboEditor.saveFailure);
		}
	};
	const draft = comboDraft(combo);
	return (
		<ComboPartEditor
			part={part}
			mode="saved"
			otherEnergy={(comboTotals(combo).energy ?? 0) - partEnergy}
			onCancel={leave}
			onConfirm={(snapshot) =>
				write(
					draft.parts.map((item) =>
						item.id === part.id ? { ...item, snapshot } : item,
					),
				)
			}
			onRemove={() => write(draft.parts.filter((item) => item.id !== part.id))}
			onReplace={() => {
				// The browser replaces the part sheet rather than stacking on it.
				leave();
				router.push({
					pathname: "/nutrition-food",
					params: { comboId: combo.id, replacePartId: part.id },
				});
			}}
		/>
	);
}
