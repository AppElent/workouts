import type { Locale } from "../i18n";
import {
	type NutrientValue,
	SHIPPED_NUTRIENT_KEYS,
	type ShippedNutrientKey,
	scaleNutrient,
} from "./nutrients";
import type { BaseUnit, Bilingual, MeasuredUnit } from "./snapshot";
import type { ShippedFood } from "./types";

export type SupplementaryServing = {
	readonly id: string;
	readonly foodId: string;
	readonly name: string;
	readonly amount: number;
	readonly unit: MeasuredUnit;
};

/**
 * What the serving picker offers for a food: the authored servings, then the
 * food's own base unit.
 *
 * The base-unit option is always present and always last — it is the escape
 * hatch for "I weighed it".
 */
export type ServingOption =
	| {
			readonly kind: "supplementary";
			readonly id: string;
			readonly label: Bilingual;
			readonly amount: number;
			readonly unit: MeasuredUnit;
	  }
	| {
			readonly kind: "personal-measure";
			readonly id: string;
			readonly label: Bilingual;
			readonly amount: number;
			readonly unit: MeasuredUnit;
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
			readonly unit: BaseUnit;
	  };

export type PersonalMeasure = {
	readonly id: string;
	readonly name: string;
	readonly amount: number;
	readonly unit: MeasuredUnit;
	readonly order: number;
};

const BASE_UNIT_LABELS: Record<BaseUnit, Bilingual> = {
	g: { en: "Gram (g)", nl: "Gram (g)" },
	ml: { en: "Millilitre (ml)", nl: "Milliliter (ml)" },
	serving: { en: "Serving", nl: "Portie" },
};

/** The base-unit choice for an amount: "I weighed it", or one serving. */
export function baseUnitServingOption(
	unit: BaseUnit,
	label: Bilingual = BASE_UNIT_LABELS[unit],
): ServingOption {
	return { kind: "base-unit", label, amount: 1, unit };
}

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
	options.push(baseUnitServingOption(food.baseUnit));
	return options;
}

/** Composes account-owned additions with immutable food choices, preserving the base-unit escape hatch. */
export function withSupplementaryServings(
	foodOptions: readonly ServingOption[],
	foodId: string | undefined,
	baseUnit: BaseUnit,
	additions: readonly SupplementaryServing[],
): ServingOption[] {
	return [
		...foodOptions.filter((option) => option.kind !== "base-unit"),
		...additions
			.filter((item) => item.foodId === foodId && item.unit === baseUnit)
			.map(
				(item): ServingOption => ({
					kind: "supplementary",
					id: item.id,
					label: { en: item.name, nl: item.name },
					amount: item.amount,
					unit: item.unit,
				}),
			),
		...foodOptions.filter((option) => option.kind === "base-unit"),
	];
}

/** Adds exact same-unit Personal Measures before a Food's own choices. */
export function withPersonalMeasures(
	foodOptions: readonly ServingOption[],
	baseUnit: BaseUnit,
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

const DECIMAL_SEPARATOR: Record<Locale, string> = { en: ".", nl: "," };

/**
 * A quantity as a person writes it: no trailing zeros, and the locale's
 * decimal separator.
 *
 * Hand-rolled rather than `Intl.NumberFormat` because this runs on Hermes,
 * where the Intl surface depends on which JSC/Hermes variant the build carries.
 */
export function formatQuantity(quantity: number, locale: Locale): string {
	const text = String(Math.round(quantity * 1000) / 1000);
	return text.replace(".", DECIMAL_SEPARATOR[locale]);
}

/**
 * Serving labels are stored on Diary Entry and Combo part snapshots as text:
 * `Glass (200 ml) × 1` for a chosen Serving, `150 g` for a bare amount.
 * Existing diary rows carry that text, so this module is the only one that
 * writes it and the only one that reads its multiplier back.
 */
const MULTIPLIER = " × ";

/**
 * The unambiguous rendering of a selection: `Glass (200 ml) × 1`.
 * Always name × quantity, never a bare gram figure, and never quantity first.
 */
export function formatServingSelection(
	option: Pick<ServingOption, "label">,
	quantity: number,
	locale: Locale,
): string {
	return `${option.label[locale]}${MULTIPLIER}${formatQuantity(quantity, locale)}`;
}

/** The snapshot label for `quantity` × a named Serving, in both languages. */
export function servingSelectionLabel(
	label: Bilingual,
	quantity: number,
): Bilingual {
	return {
		en: formatServingSelection({ label }, quantity, "en"),
		nl: formatServingSelection({ label }, quantity, "nl"),
	};
}

const AMOUNT_UNIT: Record<BaseUnit, Bilingual> = {
	g: { en: "g", nl: "g" },
	ml: { en: "ml", nl: "ml" },
	serving: { en: "serving(s)", nl: "portie(s)" },
};

/** The snapshot label for a bare total amount, such as "150 g" for a One-off Entry. */
export function servingAmountLabel(
	amount: number,
	baseUnit: BaseUnit,
): Bilingual {
	return {
		en: `${formatQuantity(amount, "en")} ${AMOUNT_UNIT[baseUnit].en}`,
		nl: `${formatQuantity(amount, "nl")} ${AMOUNT_UNIT[baseUnit].nl}`,
	};
}

function withQuantity(label: string, quantity: number, locale: Locale) {
	const name = label.slice(0, label.lastIndexOf(MULTIPLIER));
	return `${name}${MULTIPLIER}${formatQuantity(quantity, locale)}`;
}

/**
 * A snapshot's Serving label at a new quantity. A Serving label changes only
 * the multiplier at its end; a bare amount label is restated from the new
 * amount rather than gaining a multiplier it never meant.
 */
export function requantifyServingLabel(
	snapshot: { readonly serving: Bilingual; readonly baseUnit: BaseUnit },
	quantity: number,
	amount: number,
): Bilingual {
	const { serving } = snapshot;
	if (!serving.en.includes(MULTIPLIER) || !serving.nl.includes(MULTIPLIER))
		return servingAmountLabel(amount, snapshot.baseUnit);
	return {
		en: withQuantity(serving.en, quantity, "en"),
		nl: withQuantity(serving.nl, quantity, "nl"),
	};
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
	readonly baseUnit: MeasuredUnit;
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
