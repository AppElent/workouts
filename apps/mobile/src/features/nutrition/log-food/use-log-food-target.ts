import type { ServingOption } from "@workouts/core/nutrition";
import { fmt, useI18n } from "../../../i18n";
import { useToast } from "../../../ui/toast";
import { comboPartFromEntry, kcalText } from "../combo/combo-parts";
import { useComboTarget } from "../combo/use-combo-target";
import {
	type FoodSelection,
	foodPartSnapshot,
	selectionSourceKey,
} from "./log-food-selection";

/** Which combo Log food adds to, or which part it replaces. */
export type LogFoodTargetParams = {
	readonly comboId: string;
	readonly replacePartId?: string;
};

/**
 * Log food in a browser target mode (mobile-design "Browser target modes"):
 * everything that differs from logging, decided in one place. Adding keeps
 * the browser open and marks the row; replacing confirms a portion, puts the
 * pick in the old part's place and closes.
 */
export function useLogFoodTarget(
	params: LogFoodTargetParams | undefined,
	{
		onClose,
		onAdded,
	}: { onClose: () => void; onAdded: (sourceKey: string) => void },
) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.comboEditor;
	const toast = useToast();
	const target = useComboTarget(params?.comboId, params?.replacePartId);
	if (!target) return undefined;
	const { combo, replacing } = target;
	/** Writes the pick into the combo; false when it could not be saved. */
	const pick = (
		selection: FoodSelection,
		serving: ServingOption,
		quantity: number,
	) => {
		try {
			const { part, provenance } = foodPartSnapshot(
				selection,
				serving,
				quantity,
				locale,
			);
			const undo = target.write(comboPartFromEntry({ ...part, provenance }));
			toast.success(
				fmt(replacing ? copy.replaced : copy.added, {
					name: selection.food.name[locale],
				}),
				{ action: { label: copy.undo, onPress: undo } },
			);
		} catch {
			toast.error(copy.saveFailure);
			return false;
		}
		if (replacing) onClose();
		else onAdded(selectionSourceKey(selection));
		return true;
	};
	return {
		replacing: replacing !== undefined,
		title: replacing ? copy.replaceTitle : copy.addTitle,
		subtitle: replacing
			? fmt(copy.replaceSubtitle, { name: combo.name })
			: fmt(copy.addSubtitle, { name: combo.name, count: combo.parts.length }),
		/** Replacing starts from the old part's name. */
		initialQuery: replacing?.snapshot.name[locale],
		/** The part being replaced, shown above the results. */
		was: replacing
			? {
					name: replacing.snapshot.name[locale],
					missing: replacing.status === "missing",
					detail: fmt(copy.replaceWas, {
						serving: replacing.snapshot.serving[locale],
						kcal: kcalText(replacing.snapshot.nutrients.energy, locale) ?? "—",
					}),
				}
			: undefined,
		resultsTitle: replacing ? copy.chooseReplacement : undefined,
		hint: replacing ? copy.replaceHint : copy.addHint,
		/** Adding ends with Done; replacing ends with the pick. */
		doneLabel: replacing ? undefined : copy.done,
		addLabel: (what: string) => fmt(copy.addPortion, { portion: what }),
		sheet: {
			title: combo.name,
			confirmLabel: replacing ? copy.confirm : copy.add,
			valueLabel: copy.thisPart,
		},
		pick,
	};
}

export type LogFoodTarget = NonNullable<ReturnType<typeof useLogFoodTarget>>;
