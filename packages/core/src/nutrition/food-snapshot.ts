import { shippedSourceMeta } from "./library";
import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "./nutrients";
import type {
	NutritionBilingual,
	NutritionDiaryPartSnapshot,
	NutritionProvenance,
} from "./operations";
import {
	type PersonalFood,
	personalFoodSnapshot,
	personalFoodSnapshotAtAmount,
} from "./personal-food";
import {
	formatServingSelection,
	type ServingOption,
	scaleNutrients,
	servingAmount,
} from "./servings";
import type { ShippedFood } from "./types";

/** A Food in the Food Library, by kind. */
export type LibraryFood =
	| { readonly kind: "shipped"; readonly food: ShippedFood }
	| { readonly kind: "personal"; readonly food: PersonalFood };

export type ShippedFoodProvenance = Extract<
	NutritionProvenance,
	{ readonly source: "shipped" }
>;

/** Food Provenance for figures taken from a Shipped Food. */
export function shippedFoodProvenance(
	food: ShippedFood,
): ShippedFoodProvenance {
	const source = shippedSourceMeta(food);
	return {
		source: "shipped",
		sourceId: food.id,
		dataset: source.name,
		edition: source.edition,
		sourceCode: food.code,
		sourceName: food.sourceName,
		saltDerived: source.saltDerived,
	};
}

/** The nutrients a snapshot stores for `amount` base units of a Shipped Food. */
function shippedNutrients(
	food: ShippedFood,
	amount: number,
): Record<NutrientKey, NutrientValue> {
	const scaled = scaleNutrients(food, amount);
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, scaled[key]]),
	) as Record<NutrientKey, NutrientValue>;
}

/**
 * A Food at a Serving (or Personal Measure) and quantity, without a day or
 * Meal Slot: what a Diary Entry and a Combo part both store.
 */
export function foodSnapshot(
	source: LibraryFood,
	serving: ServingOption,
	quantity: number,
): NutritionDiaryPartSnapshot {
	const measure =
		serving.kind === "personal-measure"
			? { personalMeasureId: serving.id }
			: {};
	if (source.kind === "personal") {
		return {
			...personalFoodSnapshot(source.food, { quantity, serving }),
			...measure,
		};
	}
	const { food } = source;
	const amount = servingAmount(serving, quantity);
	return {
		name: food.name,
		serving: {
			en: formatServingSelection(serving, quantity, "en"),
			nl: formatServingSelection(serving, quantity, "nl"),
		},
		quantity,
		amount,
		baseUnit: food.baseUnit,
		...measure,
		nutrients: shippedNutrients(food, amount),
		provenance: shippedFoodProvenance(food),
	};
}

/**
 * A saved selection (a Combo part) at its Food's current figures. The amount,
 * quantity, and Serving label stay as saved.
 */
export function foodSnapshotAtAmount(
	source: LibraryFood,
	saved: {
		readonly amount: number;
		readonly quantity: number;
		readonly baseUnit: NutritionDiaryPartSnapshot["baseUnit"];
		readonly serving: NutritionBilingual;
	},
): NutritionDiaryPartSnapshot {
	if (source.kind === "personal") {
		return personalFoodSnapshotAtAmount(source.food, saved);
	}
	const { food } = source;
	return {
		name: food.name,
		serving: saved.serving,
		quantity: saved.quantity,
		amount: saved.amount,
		baseUnit: food.baseUnit,
		nutrients: shippedNutrients(food, saved.amount),
		provenance: shippedFoodProvenance(food),
	};
}
