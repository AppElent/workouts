import { RuleError } from "../rules";
import { type NutrientValue, rescaleNutrients } from "./nutrients";
import { requantifyServingLabel } from "./servings";
import type { BaseUnit, Bilingual } from "./snapshot";

type RescalableSnapshot = {
	readonly quantity: number;
	readonly amount: number;
	readonly baseUnit: BaseUnit;
	readonly serving: Bilingual;
	readonly nutrients: Readonly<Record<string, NutrientValue>>;
};

type RescaleField = "quantity" | "amount";

function positive(value: number, field: RescaleField): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
		throw new RuleError(field, "notPositive");
	return value;
}

/** The same snapshot at another quantity of its own Serving. */
export function rescaleToQuantity<T extends RescalableSnapshot>(
	snapshot: T,
	quantity: number,
): T {
	const factor = positive(quantity, "quantity") / snapshot.quantity;
	const amount = snapshot.amount * factor;
	return {
		...snapshot,
		quantity,
		amount,
		serving: requantifyServingLabel(snapshot, quantity, amount),
		nutrients: rescaleNutrients(snapshot.nutrients, factor),
	};
}

/** The same snapshot at a newly chosen Serving, Personal Measure, or amount. */
export function rescaleToSelection<T extends RescalableSnapshot>(
	snapshot: T,
	selection: {
		readonly serving: Bilingual;
		readonly quantity: number;
		readonly amount: number;
	},
): T {
	positive(selection.quantity, "quantity");
	const factor = positive(selection.amount, "amount") / snapshot.amount;
	return {
		...snapshot,
		quantity: selection.quantity,
		amount: selection.amount,
		serving: selection.serving,
		nutrients: rescaleNutrients(snapshot.nutrients, factor),
	};
}
