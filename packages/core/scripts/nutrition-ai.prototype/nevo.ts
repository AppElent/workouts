// PROTOTYPE — throwaway. NEVO/Lidl grounding: candidate retrieval, the full
// catalog for in-prompt selection, and deterministic nutrient arithmetic.
import { shippedLibrary } from "../../src/nutrition/library";
import { searchShippedFoods } from "../../src/nutrition/search";
import type { ShippedFood } from "../../src/nutrition/types";

export const MACROS = [
	"energy",
	"protein",
	"carbs",
	"fat",
	"saturatedFat",
	"sugars",
	"fibre",
	"salt",
] as const;
export type Macro = (typeof MACROS)[number];
export type Totals = Record<Macro, number>;

export function refOf(food: ShippedFood): string {
	return `${food.source}:${food.code}`;
}

let byRef: Map<string, ShippedFood> | undefined;
export function foodByRef(ref: string): ShippedFood | undefined {
	if (!byRef) {
		byRef = new Map(shippedLibrary().active.map((food) => [refOf(food), food]));
	}
	return byRef.get(ref.trim());
}

/** Descriptive Dutch name: NEVO's verbatim name, which carries preparation. */
export function label(food: ShippedFood): string {
	return food.sourceName.nl;
}

/** Union of search hits over several terms, best rank first, deduped. */
export function candidates(
	terms: readonly string[],
	limit = 12,
): ShippedFood[] {
	const seen = new Map<string, { food: ShippedFood; rank: number }>();
	for (const term of terms) {
		const hits = searchShippedFoods(term, {
			scope: "all",
			locale: "nl",
			limit: 8,
		});
		hits.forEach((hit, index) => {
			const ref = refOf(hit.food);
			const prior = seen.get(ref);
			if (!prior || prior.rank > index)
				seen.set(ref, { food: hit.food, rank: index });
		});
	}
	return [...seen.values()]
		.sort((a, b) => a.rank - b.rank)
		.slice(0, limit)
		.map((entry) => entry.food);
}

/** One line per active food — the "whole list in the prompt" strategy. */
let catalog: string | undefined;
export function catalogText(): string {
	if (!catalog) {
		catalog = shippedLibrary()
			.active.map((food) => `${refOf(food)}\t${label(food)}`)
			.join("\n");
	}
	return catalog;
}

export function nutrientsFor(
	food: ShippedFood,
	grams: number,
): { totals: Totals; missing: Macro[] } {
	const totals = Object.fromEntries(MACROS.map((m) => [m, 0])) as Totals;
	const missing: Macro[] = [];
	for (const macro of MACROS) {
		const value = food.nutrients[macro];
		if (value.kind === "value") totals[macro] = (value.amount * grams) / 100;
		else if (value.kind === "absent") missing.push(macro);
	}
	return { totals, missing };
}

export function sumTotals(list: readonly Totals[]): Totals {
	const out = Object.fromEntries(MACROS.map((m) => [m, 0])) as Totals;
	for (const totals of list) for (const m of MACROS) out[m] += totals[m];
	return out;
}
