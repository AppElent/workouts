import {
	type Locale,
	personalFoodServingOptions,
	personalFoodSnapshot,
	previewServing,
	type ServingOption,
	servingOptions,
	withPersonalMeasures,
	withSupplementaryServings,
} from "@foundry/core";
import type { LibraryFood } from "@foundry/core/shipped-foods";
import { foodSourceKey } from "../../../data/nutrition-shortcuts";

export type FoodSelection = LibraryFood;

export type LogOutcome = "continue" | "close";

/**
 * The log food screen's source scopes. They keep the "tab" name, but the screen
 * does not present them as exclusive tabs: `pool` is the default and searches
 * every source at once, and the rest narrow what is already in front of you.
 * `all` stays the deliberate broader view (spec #75) — the only place a
 * corrected shipped record is still listed — shown as "Catalogus".
 */
export type FoodBrowserTab =
	| "pool"
	| "recent"
	| "favorites"
	| "combos"
	| "recipes"
	| "all";
export type FoodFilter = FoodBrowserTab;

export function servingChoices(
	selection: FoodSelection,
	personalMeasures: readonly import("@foundry/core").PersonalMeasure[],
	supplementary: readonly import("@foundry/core").SupplementaryServing[] = [],
): ServingOption[] {
	const foodOptions =
		selection.kind === "shipped"
			? servingOptions(selection.food)
			: personalFoodServingOptions(selection.food);
	return withPersonalMeasures(
		withSupplementaryServings(
			foodOptions,
			selection.kind === "shipped" ? selection.food.id : undefined,
			selection.food.baseUnit,
			supplementary,
		),
		selection.food.baseUnit,
		personalMeasures,
	);
}

export function servingPreview(
	selection: FoodSelection,
	option: ServingOption,
	quantity: number,
	locale: Locale,
) {
	if (selection.kind === "shipped") {
		return previewServing(selection.food, option, quantity, locale);
	}
	const snapshot = personalFoodSnapshot(selection.food, {
		quantity,
		serving: option,
	});
	return {
		amount: snapshot.amount,
		baseUnit: snapshot.baseUnit,
		label: snapshot.serving[locale],
		nutrients: snapshot.nutrients,
	};
}

/** The durable shortcut key for a selection (favorite, recent, remembered portion). */
export function selectionSourceKey(selection: FoodSelection): string {
	return foodSourceKey(
		selection.kind === "shipped" ? "shipped" : "personal",
		selection.food.id,
	);
}
