import type { ComboPartDraft } from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { comboDraft, withComboPart } from "./combo-parts";

/**
 * The combo a food browser adds to or replaces in (browser target mode).
 * `write` saves the part right away and returns the undo.
 */
export function useComboTarget(comboId?: string, replacePartId?: string) {
	const library = usePersonalFoods();
	const combo = comboId ? library.findCombo(comboId) : undefined;
	if (!combo) return undefined;
	const replacing = replacePartId
		? combo.parts.find((part) => part.id === replacePartId)
		: undefined;
	return {
		combo,
		replacing,
		write(part: ComboPartDraft) {
			const before = comboDraft(combo);
			library.updateCombo(combo.id, withComboPart(combo, part, replacing?.id));
			return () => {
				library.updateCombo(combo.id, before);
			};
		},
	};
}

export type ComboTarget = NonNullable<ReturnType<typeof useComboTarget>>;
