import type { ServingOption } from "@workouts/core/nutrition";
import { useRef, useState } from "react";
import {
	type ComboPartChoice,
	comboLogEntries,
	comboLogPlan,
} from "../../../data/nutrition-combo";
import type { MealSlot } from "../../../data/nutrition-day";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../../../data/nutrition-operation-service";
import type {
	Combo,
	ComboPart,
	ComboPartSnapshot,
} from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useAmountSelection } from "../use-amount-selection";

/** Whole combos are the serving the capsule counts in. */
const WHOLE_COMBO: ServingOption = {
	kind: "authored",
	index: -1,
	amount: 1,
	label: { en: "combo", nl: "combo" },
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
	onFailed,
}: {
	combo: Combo;
	meal: MealSlot;
	date: string;
	onLogged: () => void;
	onFailed: () => void;
}) {
	const foods = usePersonalFoods({ ids: [combo.id] });
	const operations = useNutritionOperations();
	const whole = useAmountSelection({
		option: WHOLE_COMBO,
		quantity: 1,
		amount: 1,
	});
	const [destination, setDestination] = useState({ meal, date });
	const [choices, setChoices] = useState<Record<string, ComboPartChoice>>({});
	const [logging, setLogging] = useState(false);
	const lock = useRef(false);
	const plan = comboLogPlan(combo, choices, foods.find);
	const canLog =
		whole.valid && plan.included.length > 0 && !logging && !foods.loading;

	function log() {
		if (!canLog || lock.current) return;
		lock.current = true;
		setLogging(true);
		const fail = () => {
			lock.current = false;
			setLogging(false);
			onFailed();
		};
		try {
			const subject = operations.getSubject();
			if (!subject) throw new Error("Not signed in.");
			const comboGroup = {
				id: mintNutritionUuid(),
				comboId: combo.id,
				name: combo.name,
			};
			operations.createBatch(
				subject,
				destination.date,
				destination.meal,
				comboLogEntries(plan, whole.quantity).map((snapshot) => ({
					...snapshot,
					date: destination.date,
					meal: destination.meal,
					comboGroup,
					clientEntryId: mintNutritionUuid(),
				})),
				fail,
				() => {
					lock.current = false;
					setLogging(false);
					onLogged();
				},
			);
		} catch {
			fail();
		}
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
