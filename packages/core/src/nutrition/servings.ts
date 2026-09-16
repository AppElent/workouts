import {
	type NutrientValue,
	SHIPPED_NUTRIENT_KEYS,
	type ShippedNutrientKey,
	scaleNutrient,
} from "./nutrients";
import type { Bilingual, Locale, ShippedFood, ShippedServing } from "./types";

/**
 * What the serving picker offers for a food: the authored servings, then the
 * food's own base unit.
 *
 * The base-unit option is always present and always last — it is the escape
 * hatch for "I weighed it", and story 38 makes it non-optional.
 */
export type ServingOption =
	| {
			readonly kind: "personal-measure";
			readonly id: string;
			readonly label: Bilingual;
			readonly amount: number;
			readonly unit: "g" | "ml";
	  }
	| {
			readonly kind: "authored";
			/** Index into the food's `servings`, so a selection can be stored. */
			readonly index: number;
			readonly label: Bilingual;
			readonly amount: number;
			readonly volumeMl?: number;
			readonly note?: string;
	  }
	| {
			readonly kind: "base-unit";
			readonly label: Bilingual;
			/** One gram or one millilitre; quantity does the rest. */
			readonly amount: 1;
			readonly unit: "g" | "ml" | "serving";
	  };

export type PersonalMeasure = {
	readonly id: string;
	readonly name: string;
	readonly amount: number;
	readonly unit: "g" | "ml";
	readonly order: number;
};

const BASE_UNIT_LABELS: Record<"g" | "ml", Bilingual> = {
	g: { en: "Gram (g)", nl: "Gram (g)" },
	ml: { en: "Millilitre (ml)", nl: "Milliliter (ml)" },
};

/** The serving choices for a food, authored first, base unit last. */
export function servingOptions(food: ShippedFood): ServingOption[] {
	const options: ServingOption[] = food.servings.map((serving, index) => ({
		kind: "authored" as const,
		index,
		label: serving.label,
		amount: serving.amount,
		...(serving.volumeMl === undefined ? {} : { volumeMl: serving.volumeMl }),
		...(serving.note === undefined ? {} : { note: serving.note }),
	}));
	options.push({
		kind: "base-unit",
		label: BASE_UNIT_LABELS[food.baseUnit],
		amount: 1,
		unit: food.baseUnit,
	});
	return options;
}

/** Adds exact same-unit Personal Measures before a Food's own choices. */
export function withPersonalMeasures(
	foodOptions: readonly ServingOption[],
	baseUnit: "g" | "ml" | "serving",
	measures: readonly PersonalMeasure[],
): ServingOption[] {
	if (baseUnit === "serving") return [...foodOptions];
	const compatible = [...measures]
		.filter((measure) => measure.unit === baseUnit)
		.sort((left, right) => left.order - right.order)
		.map((measure): ServingOption => {
			return {
				kind: "personal-measure",
				id: measure.id,
				label: {
					en: `${measure.name} (${formatQuantity(measure.amount, "en")} ${measure.unit})`,
					nl: `${measure.name} (${formatQuantity(measure.amount, "nl")} ${measure.unit})`,
				},
				amount: measure.amount,
				unit: measure.unit,
			};
		});
	const authored = foodOptions.filter((option) => {
		if (option.kind !== "authored") return true;
		return !compatible.some((measure) => {
			const name = measure.label.en
				.replace(/\s*\([^)]*\)$/, "")
				.trim()
				.toLowerCase();
			const exact = measure.label.en.toLowerCase();
			return (
				option.amount === measure.amount &&
				[option.label.en, option.label.nl].some((label) => {
					const normalized = label.trim().toLowerCase();
					return normalized === name || normalized === exact;
				})
			);
		});
	});
	return [...compatible, ...authored];
}

/** How many base units `quantity` of this option comes to. */
export function servingAmount(option: ServingOption, quantity: number): number {
	return option.amount * quantity;
}

/**
 * A quantity as a person writes it: no trailing zeros, and a decimal comma in
 * Dutch.
 *
 * Hand-rolled rather than `Intl.NumberFormat` because this runs on Hermes,
 * where the Intl surface depends on which JSC/Hermes variant the build carries.
 */
export function formatQuantity(quantity: number, locale: Locale): string {
	const text = String(Math.round(quantity * 1000) / 1000);
	return locale === "nl" ? text.replace(".", ",") : text;
}

/**
 * The unambiguous rendering of a selection: `Glass (200 ml) × 1` (story 39).
 * Always name × quantity, never a bare gram figure, and never quantity first.
 */
export function formatServingSelection(
	option: ServingOption,
	quantity: number,
	locale: Locale,
): string {
	return `${option.label[locale]} × ${formatQuantity(quantity, locale)}`;
}

/**
 * The nutrients in `amount` base units of a food.
 *
 * Shipped figures are per 100 base units, so this is a plain ratio. Results are
 * unrounded — round at the edge, once, for display.
 */
export function scaleNutrients(
	food: ShippedFood,
	amount: number,
): Record<ShippedNutrientKey, NutrientValue> {
	const factor = amount / 100;
	const scaled = {} as Record<ShippedNutrientKey, NutrientValue>;
	for (const key of SHIPPED_NUTRIENT_KEYS) {
		scaled[key] = scaleNutrient(food.nutrients[key], factor);
	}
	return scaled;
}

/** A read-only preview of choosing `quantity` × this serving. */
export type ServingPreview = {
	readonly option: ServingOption;
	readonly quantity: number;
	/** Base units the selection comes to. */
	readonly amount: number;
	readonly baseUnit: "g" | "ml";
	/** `Glass (200 ml) × 1`, in the requested locale. */
	readonly label: string;
	readonly nutrients: Record<ShippedNutrientKey, NutrientValue>;
};

export function previewServing(
	food: ShippedFood,
	option: ServingOption,
	quantity: number,
	locale: Locale,
): ServingPreview {
	const amount = servingAmount(option, quantity);
	return {
		option,
		quantity,
		amount,
		baseUnit: food.baseUnit,
		label: formatServingSelection(option, quantity, locale),
		nutrients: scaleNutrients(food, amount),
	};
}

/**
 * The gram amount behind a volume-labelled serving on a mass-based food.
 *
 * Every NEVO beverage is per 100 g, so `Glass (250 ml)` of milk stores a mass.
 * Returns `undefined` when the serving is not volume-labelled.
 */
export function servingVolumeMapping(serving: ShippedServing):
	| {
			volumeMl: number;
			grams: number;
			basis: NonNullable<ShippedServing["basis"]>;
			note?: string;
	  }
	| undefined {
	if (serving.volumeMl === undefined || serving.basis === undefined)
		return undefined;
	return {
		volumeMl: serving.volumeMl,
		grams: serving.amount,
		basis: serving.basis,
		...(serving.note === undefined ? {} : { note: serving.note }),
	};
}
