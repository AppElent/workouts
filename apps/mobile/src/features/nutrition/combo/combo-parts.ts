import {
	type PersonalFood,
	personalFoodSnapshotAtAmount,
} from "@workouts/core/nutrition";
import type { DiaryEntry } from "../../../data/nutrition-day";
import type {
	Combo,
	ComboDraft,
	ComboPartDraft,
	ComboPartReference,
} from "../../../data/personal-food-repository";

/** A diary entry as a combo part: its food by reference, or a one-off snapshot. */
export function comboPartFromEntry(entry: DiaryEntry): ComboPartDraft {
	const reference: ComboPartReference =
		entry.provenance.source === "shipped"
			? { kind: "shipped", foodId: entry.provenance.sourceId }
			: entry.provenance.source === "personal" ||
					entry.provenance.source === "import"
				? { kind: "personal", foodId: entry.provenance.sourceId }
				: { kind: "oneOff" };
	return {
		reference,
		snapshot: {
			name: entry.name,
			serving: entry.serving,
			quantity: entry.quantity,
			amount: entry.amount,
			baseUnit: entry.baseUnit,
			nutrients: entry.nutrients,
			provenance: entry.provenance,
			...(entry.estimated ? { estimated: true as const } : {}),
		},
	};
}

/**
 * A library food as a new combo part: its first serving, otherwise 100 g/ml,
 * or one serving when its values are per serving.
 */
export function comboPartFromFood(food: PersonalFood): ComboPartDraft {
	const serving = food.baseUnit === "serving" ? undefined : food.servings[0];
	const amount = serving?.amount ?? (food.baseUnit === "serving" ? 1 : 100);
	const label =
		serving?.label ??
		(food.nutritionBasis.kind === "perServing"
			? food.nutritionBasis.label
			: { en: `${amount} ${food.baseUnit}`, nl: `${amount} ${food.baseUnit}` });
	const snapshot = personalFoodSnapshotAtAmount(food, {
		amount,
		quantity: 1,
		baseUnit: food.baseUnit,
		serving: label,
	});
	return {
		reference: { kind: "personal", foodId: food.id },
		snapshot: {
			name: snapshot.name,
			serving: snapshot.serving,
			quantity: snapshot.quantity,
			amount: snapshot.amount,
			baseUnit: snapshot.baseUnit,
			nutrients: snapshot.nutrients,
			provenance:
				snapshot.provenance as ComboPartDraft["snapshot"]["provenance"],
			...(snapshot.estimated ? { estimated: true as const } : {}),
		},
	};
}

/** kcal and the three macros, summed from the saved snapshots. */
export function comboTotals(combo: Pick<Combo, "parts">) {
	const sum = (key: "energy" | "protein" | "carbs" | "fat") => {
		let total = 0;
		let known = false;
		for (const part of combo.parts) {
			const value = part.snapshot.nutrients[key];
			if (value.kind !== "value") continue;
			known = true;
			total += value.amount;
		}
		return known ? Math.round(total * 10) / 10 : undefined;
	};
	return {
		energy: sum("energy"),
		protein: sum("protein"),
		carbs: sum("carbs"),
		fat: sum("fat"),
	};
}

/** The saved combo as an editable draft; part ids stay so updates keep them. */
export function comboDraft(combo: Combo): ComboDraft & {
	parts: (ComboPartDraft & { id: string })[];
} {
	return {
		name: combo.name,
		parts: combo.parts.map(({ status: _status, ...part }) => part),
	};
}

export function moveComboPart(combo: Combo, partId: string, by: -1 | 1): Combo {
	const index = combo.parts.findIndex((part) => part.id === partId);
	const target = index + by;
	if (index < 0 || target < 0 || target >= combo.parts.length) return combo;
	const parts = [...combo.parts];
	[parts[index], parts[target]] = [parts[target], parts[index]];
	return { ...combo, parts };
}

export function withoutMissingParts(combo: Combo): Combo {
	return {
		...combo,
		parts: combo.parts.filter((part) => part.status !== "missing"),
	};
}
