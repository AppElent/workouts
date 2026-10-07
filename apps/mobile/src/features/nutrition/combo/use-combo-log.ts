import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type ServingOption,
} from "@workouts/core/nutrition";
import { useRef, useState } from "react";
import {
	resolveComboPart,
	scaleComboSnapshot,
} from "../../../data/nutrition-combo";
import type { MealSlot } from "../../../data/nutrition-day";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../../../data/nutrition-operation-service";
import type {
	Combo,
	ComboPartSnapshot,
} from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useAmountSelection } from "../components/use-amount-selection";

/** Whole combos are the serving the capsule counts in. */
const WHOLE_COMBO: ServingOption = {
	kind: "authored",
	index: -1,
	amount: 1,
	label: { en: "combo", nl: "combo" },
};

type PartChoice = {
	included: boolean;
	/** An "only this time" amount, rescaled from the saved snapshot. */
	once?: ComboPartSnapshot;
};

function sumNutrients(
	snapshots: readonly ComboPartSnapshot[],
): Record<NutrientKey, NutrientValue> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			let total = 0;
			let known = false;
			let trace = false;
			for (const snapshot of snapshots) {
				const value = snapshot.nutrients[key];
				if (value.kind === "value") {
					known = true;
					total += value.amount;
				} else if (value.kind === "trace") trace = true;
			}
			return [
				key,
				known
					? { kind: "value", amount: total }
					: trace
						? { kind: "trace" }
						: { kind: "absent" },
			];
		}),
	) as Record<NutrientKey, NutrientValue>;
}

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
	const foods = usePersonalFoods();
	const operations = useNutritionOperations();
	const whole = useAmountSelection({
		option: WHOLE_COMBO,
		quantity: 1,
		amount: 1,
	});
	const [destination, setDestination] = useState({ meal, date });
	const [choices, setChoices] = useState<Record<string, PartChoice>>({});
	const [logging, setLogging] = useState(false);
	const lock = useRef(false);
	const choiceFor = (partId: string): PartChoice =>
		choices[partId] ?? { included: true };
	const parts = combo.parts.map((part) => ({ part, ...choiceFor(part.id) }));
	const included = parts.filter((item) => item.included);
	// A part whose source is gone waits until it is replaced, removed or off.
	const blockedByMissing = included.some(
		({ part }) => part.status === "missing",
	);
	const canLog =
		whole.valid && included.length > 0 && !blockedByMissing && !logging;
	/** Per-combo values of what is included, before the whole-combo factor. */
	const nutrients = sumNutrients(
		included.map(({ part, once }) => once ?? part.snapshot),
	);

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
				included.map(({ part, once }) => ({
					...scaleComboSnapshot(
						once ?? resolveComboPart(part, foods.find),
						whole.quantity,
					),
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
		parts,
		nutrients,
		blockedByMissing,
		canLog,
		logging,
		log,
		toggle: (partId: string) =>
			setChoices((current) => ({
				...current,
				[partId]: {
					...choiceFor(partId),
					included: !choiceFor(partId).included,
				},
			})),
		setOnce: (partId: string, snapshot: ComboPartSnapshot) =>
			setChoices((current) => ({
				...current,
				[partId]: { included: true, once: snapshot },
			})),
	};
}
