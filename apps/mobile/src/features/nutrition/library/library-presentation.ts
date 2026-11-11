import { type Locale, roundForDisplay } from "@foundry/core";
import { fmt, plural } from "../../../i18n";
import type { foodLibraryEn } from "../../../i18n/messages/food-library";
import { comboEnergy } from "../combo/combo-log-plan";
import type { LibraryItem } from "./library-items";

const SOURCE_BADGE = {
	openfoodfacts: "OFF",
	nevo: "NEVO",
	lidl: "Lidl",
} as const;

/** The line under a row's name: where its values come from, or its parts. */
export function libraryCaption(
	item: LibraryItem,
	locale: Locale,
	copy: typeof foodLibraryEn,
): string {
	if (item.kind === "combo") {
		const parts = plural(locale, item.combo.parts.length, copy.parts);
		return item.combo.parts.some((part) => part.status === "missing")
			? `${parts} · ${copy.missingPart}`
			: parts;
	}
	const { food } = item;
	const source = food.provenance.nutritionSource;
	if (source === "openfoodfacts") {
		const details = [food.provenance.brand, food.provenance.quantity].filter(
			Boolean,
		);
		return [SOURCE_BADGE.openfoodfacts, ...details].join(" · ");
	}
	if (source !== "manual")
		return `${SOURCE_BADGE[source]} · ${fmt(copy.adjustedFrom, { source: SOURCE_BADGE[source] })}`;
	if (food.estimated) return copy.estimated;
	const serving = food.servings[0]?.label[locale];
	return item.kind === "recipe" && serving ? serving : copy.own;
}

/** "389 kcal" over "per 100 g", "per bottle" or "whole combo". */
export function libraryEnergy(
	item: LibraryItem,
	locale: Locale,
	copy: typeof foodLibraryEn,
): { value: string; basis: string } {
	if (item.kind === "combo") {
		const energy = comboEnergy(item.combo);
		return {
			value:
				energy === undefined
					? "— kcal"
					: `${energy.toLocaleString(locale)} kcal`,
			basis: copy.wholeCombo,
		};
	}
	const { food } = item;
	const energy = food.nutrients.energy;
	const value =
		energy.kind === "value"
			? `${roundForDisplay("energy", energy.amount).toLocaleString(locale)} kcal`
			: energy.kind === "trace"
				? "~0 kcal"
				: "— kcal";
	const basis =
		food.nutritionBasis.kind === "per100"
			? fmt(copy.per100, { unit: food.nutritionBasis.unit })
			: fmt(copy.perServing, {
					label: food.nutritionBasis.label[locale],
				});
	return { value, basis };
}
