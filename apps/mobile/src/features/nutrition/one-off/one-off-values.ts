import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { type NutrientInput, parseFoodNumber } from "../use-nutrient-fields";

/** What the typed values are for: the whole amount eaten, or 100 g or ml. */
export type OneOffBasis = "total" | "per100";

/**
 * The typed values as the totals a one-off stores. Per 100 g/ml is scaled
 * by the amount without rounding. Undefined when a value is not a number.
 */
export function oneOffNutrients(
	inputs: Readonly<Record<NutrientKey, NutrientInput>>,
	{ basis, amount }: { basis: OneOffBasis; amount: number },
): Record<NutrientKey, NutrientValue> | undefined {
	const factor = basis === "per100" ? amount / 100 : 1;
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		const input = inputs[key];
		if (input.kind !== "value") {
			nutrients[key] = { kind: input.kind };
			continue;
		}
		const value = parseFoodNumber(input.amount);
		if (!Number.isFinite(value) || value < 0) return undefined;
		nutrients[key] = { kind: "value", amount: value * factor };
	}
	return nutrients;
}
