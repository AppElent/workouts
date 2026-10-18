import { type NutrientValue, rescaleNutrients } from "./nutrients";
import type { NutritionBilingual } from "./operations";
import { formatQuantity } from "./servings";

/**
 * Rescaling a Diary Entry or Combo part snapshot. Artifact-free, so the
 * `@foundry/core` barrel (web and Convex) can share it with mobile.
 */
type RescalableSnapshot = {
	readonly quantity: number;
	readonly amount: number;
	readonly baseUnit: "g" | "ml" | "serving";
	readonly serving: NutritionBilingual;
	readonly nutrients: Readonly<Record<string, NutrientValue>>;
};

function positive(value: number, label: string): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		throw new Error(`${label} must be greater than zero.`);
	}
	return value;
}

const MULTIPLIER = " × ";

/** A total-amount Serving label, such as "150 g" for a One-off Entry. */
export function formatSnapshotAmount(
	amount: number,
	baseUnit: "g" | "ml" | "serving",
): NutritionBilingual {
	return {
		en: `${formatQuantity(amount, "en")} ${baseUnit === "serving" ? "serving(s)" : baseUnit}`,
		nl: `${formatQuantity(amount, "nl")} ${baseUnit === "serving" ? "portie(s)" : baseUnit}`,
	};
}

function withMultiplier(label: string, quantity: number, locale: "en" | "nl") {
	const name = label.slice(0, label.lastIndexOf(MULTIPLIER));
	return `${name}${MULTIPLIER}${formatQuantity(quantity, locale)}`;
}

/**
 * `serving` is snapshot text, not a reference back to a Food. A Serving
 * label — "Glass (200 ml) × 1" — changes only the multiplier at its end. A
 * label without one states the total amount — "150 g" — so it is restated
 * from the new amount rather than gaining a multiplier it never meant.
 */
export function relabelServing(
	snapshot: Pick<RescalableSnapshot, "serving" | "baseUnit">,
	quantity: number,
	amount: number,
): NutritionBilingual {
	const { serving } = snapshot;
	if (!serving.en.includes(MULTIPLIER) || !serving.nl.includes(MULTIPLIER))
		return formatSnapshotAmount(amount, snapshot.baseUnit);
	return {
		en: withMultiplier(serving.en, quantity, "en"),
		nl: withMultiplier(serving.nl, quantity, "nl"),
	};
}

/** The same snapshot at another quantity of its own Serving. */
export function rescaleToQuantity<T extends RescalableSnapshot>(
	snapshot: T,
	quantity: number,
): T {
	const factor = positive(quantity, "Quantity") / snapshot.quantity;
	const amount = snapshot.amount * factor;
	return {
		...snapshot,
		quantity,
		amount,
		serving: relabelServing(snapshot, quantity, amount),
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
