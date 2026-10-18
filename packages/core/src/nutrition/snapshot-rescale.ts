import { type NutrientValue, rescaleNutrients } from "./nutrients";
import type { NutritionBilingual } from "./operations";
import { formatQuantity } from "./servings";

/**
 * Rescaling a Diary Entry or Combo part snapshot. Artifact-free, so the
 * `@workouts/core` barrel (web and Convex) can share it with mobile.
 */
type RescalableSnapshot = {
	readonly quantity: number;
	readonly amount: number;
	readonly serving: NutritionBilingual;
	readonly nutrients: Readonly<Record<string, NutrientValue>>;
};

function positive(value: number, label: string): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		throw new Error(`${label} must be greater than zero.`);
	}
	return value;
}

function relabel(label: string, quantity: number, locale: "en" | "nl") {
	const separator = label.lastIndexOf(" × ");
	const name = separator === -1 ? label : label.slice(0, separator);
	return `${name} × ${formatQuantity(quantity, locale)}`;
}

/**
 * `serving` is snapshot text — "Glass (200 ml) × 1" — not a reference back to
 * a Food, so a new quantity changes only the multiplier at its end. A label
 * without one gains it.
 */
export function relabelServing(
	serving: NutritionBilingual,
	quantity: number,
): NutritionBilingual {
	return {
		en: relabel(serving.en, quantity, "en"),
		nl: relabel(serving.nl, quantity, "nl"),
	};
}

/** The same snapshot at another quantity of its own Serving. */
export function rescaleToQuantity<T extends RescalableSnapshot>(
	snapshot: T,
	quantity: number,
): T {
	const factor = positive(quantity, "Quantity") / snapshot.quantity;
	return {
		...snapshot,
		quantity,
		amount: snapshot.amount * factor,
		serving: relabelServing(snapshot.serving, quantity),
		nutrients: rescaleNutrients(snapshot.nutrients, factor),
	};
}

/** The same snapshot at a newly chosen Serving, Personal Measure, or amount. */
export function rescaleToSelection<T extends RescalableSnapshot>(
	snapshot: T,
	selection: {
		readonly serving: NutritionBilingual;
		readonly quantity: number;
		readonly amount: number;
	},
): T {
	positive(selection.quantity, "Quantity");
	const factor = positive(selection.amount, "Amount") / snapshot.amount;
	return {
		...snapshot,
		quantity: selection.quantity,
		amount: selection.amount,
		serving: selection.serving,
		nutrients: rescaleNutrients(snapshot.nutrients, factor),
	};
}
