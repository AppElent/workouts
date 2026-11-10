import {
	type Locale,
	NUTRIENT_UNITS,
	type NutrientKey,
	type NutrientTotal,
	roundForDisplay,
} from "@foundry/core";

type FormatOptions = { readonly unit?: boolean };

/** A nutrient figure as the app shows it: its display rounding, the locale's digits, optionally its unit. */
export function formatNutrientAmount(
	key: NutrientKey,
	amount: number,
	locale: Locale,
	{ unit = false }: FormatOptions = {},
): string {
	const number = roundForDisplay(key, amount).toLocaleString(locale);
	return unit ? `${number} ${NUTRIENT_UNITS[key]}` : number;
}

/** A total, marked "≥" when some entries lack the nutrient and "~" when it includes estimates. */
export function formatNutrientTotal(
	key: NutrientKey,
	total: Pick<NutrientTotal, "amount" | "incomplete" | "qualified"> | undefined,
	locale: Locale,
	options?: FormatOptions,
): string {
	const amount = formatNutrientAmount(key, total?.amount ?? 0, locale, options);
	if (total?.incomplete) return `≥ ${amount}`;
	if (total?.qualified) return `~ ${amount}`;
	return amount;
}
