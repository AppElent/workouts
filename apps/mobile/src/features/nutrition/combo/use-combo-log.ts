import type { ComboPartSnapshot, MealSlot, ServingOption } from "@foundry/core";
import { useState } from "react";
import {
	comboPortion,
	useFoodShortcuts,
} from "../../../data/nutrition-shortcuts";
import type { Combo, ComboPart } from "../../../data/personal-food-model";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useI18n } from "../../../i18n";
import { useAmountSelection } from "../use-amount-selection";
import { useDiaryWrite } from "../use-diary-write";
import {
	type ComboPartChoice,
	comboLogEntries,
	comboLogPlan,
} from "./combo-log-plan";

/** Whole combos are the serving the capsule counts in. */
const WHOLE_COMBO: ServingOption = {
	kind: "authored",
	index: -1,
	amount: 1,
	label: comboPortion(1).label,
};

/**
 * Logging a combo: how many whole combos, which parts this time and any
 * one-off amounts, and where it goes. Nothing changes the saved combo;
 * closing without ✓ discards it all.
 */
export function useComboLog({
	combo,
	meal,
	date,
	onLogged,
}: {
	combo: Combo;
	meal: MealSlot;
	date: string;
	onLogged: () => void;
}) {
	const foods = usePersonalFoods({ ids: [combo.id] });
	const { t } = useI18n();
	const write = useDiaryWrite();
	const shortcuts = useFoodShortcuts();
	const whole = useAmountSelection({
		option: WHOLE_COMBO,
		quantity: shortcuts.comboQuantity(combo.id),
		amount: 1,
	});
	const [destination, setDestination] = useState({ meal, date });
	const [choices, setChoices] = useState<Record<string, ComboPartChoice>>({});
	const logging = write.busy;
	const plan = comboLogPlan(combo, choices, foods.find);
	const canLog =
		whole.valid && plan.included.length > 0 && !logging && !foods.loading;

	async function log() {
		if (!canLog) return;
		const logged = await write.run(
			t.nutrition.comboEditor.logFailure,
			(diary) =>
				diary.logCombo(
					combo,
					destination.date,
					destination.meal,
					comboLogEntries(plan, whole.quantity),
					whole.quantity,
				),
		);
		if (logged) onLogged();
	}

	return {
		whole,
		destination,
		setMeal: (next: MealSlot) =>
			setDestination((current) => ({ ...current, meal: next })),
		setDate: (next: string) =>
			setDestination((current) => ({ ...current, date: next })),
		parts: plan.parts,
		included: plan.included,
		missing: plan.missing,
		/** Per-combo values of what is included, before the whole-combo factor. */
		nutrients: plan.nutrients,
		canLog,
		logging,
		log,
		toggle: (part: ComboPart) => {
			if (part.status === "missing") return;
			setChoices((current) => {
				const choice = current[part.id] ?? { included: true };
				return {
					...current,
					[part.id]: { ...choice, included: !choice.included },
				};
			});
		},
		setOnce: (partId: string, snapshot: ComboPartSnapshot) =>
			setChoices((current) => ({
				...current,
				[partId]: { included: true, once: snapshot },
			})),
	};
}
