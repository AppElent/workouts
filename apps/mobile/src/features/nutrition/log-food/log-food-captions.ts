import {
	type Locale,
	type NutrientKey,
	type NutrientValue,
	roundForDisplay,
} from "@foundry/core";
import type { FoodResult } from "@foundry/core/shipped-foods";
import type {
	OffLookupOutcome,
	OffSearchOutcome,
} from "../../../data/open-food-facts";
import type { PersonalFood } from "../../../data/personal-food-repository";
import { fmt, type Messages } from "../../../i18n";

import type { servingPreview } from "./log-food-selection";

/**
 * The line under a result's name.
 *
 * A correction says so, and — in the deliberate broader view, the only place
 * it is still listed — so does the shipped record it replaced. Neither ever
 * hides the other.
 *
 * At six cases this should become a core function returning a caption *kind*
 * that the screen translates; at four, the hop through core buys nothing.
 */
export function resultCaption(
	result: FoodResult<PersonalFood>,
	messages: Messages["nutrition"],
	locale: Locale,
	sources: { readonly shipped: string; readonly own: string },
): string {
	if (result.kind === "local") {
		return result.shadows
			? fmt(messages.fork.forkedFrom, {
					name: result.shadows.sourceName[locale],
				})
			: sources.own;
	}
	return result.shadowedBy ? messages.fork.shadowed : sources.shipped;
}

/** The compact per-100 figure a row caption ends with: "151 kcal/100 g". */
export function compactEnergyPer100(
	food: {
		nutrients: Record<NutrientKey, NutrientValue>;
		baseUnit: "g" | "ml" | "serving";
	},
	servingWord: string,
): string {
	const energy = food.nutrients.energy;
	const amount =
		energy.kind === "value"
			? String(roundForDisplay("energy", energy.amount))
			: energy.kind === "trace"
				? "~0"
				: "—";
	return food.baseUnit === "serving"
		? `${amount} kcal/${servingWord}`
		: `${amount} kcal/100 ${food.baseUnit}`;
}

export function offProductCaption(
	provenance: PersonalFood["provenance"],
	fallback: string,
): string {
	const details = [
		provenance.brand,
		provenance.quantity,
		provenance.providerServing?.label,
	].filter(Boolean);
	return details.length ? [fallback, ...details].join(" · ") : fallback;
}

export function quickEnergyAmount(
	preview: ReturnType<typeof servingPreview>,
): string | undefined {
	const energy = preview.nutrients.energy;
	return energy.kind === "value"
		? String(roundForDisplay("energy", energy.amount))
		: undefined;
}

/** Every non-"found" outcome is a failure exit: report it and leave Search and Enter manually where they already are. */
export function offFailureMessage(
	kind: Exclude<OffLookupOutcome["kind"] | OffSearchOutcome["kind"], "found">,
	foodImport: Messages["nutrition"]["foodImport"],
	isSearch: boolean,
): string {
	switch (kind) {
		case "not-found":
			return isSearch ? foodImport.searchNotFound : foodImport.notFound;
		case "rate-limited":
			return foodImport.rateLimited;
		case "timeout":
			return foodImport.timeout;
		case "network-error":
			return foodImport.networkError;
		case "unavailable":
			return foodImport.unavailable;
		case "incomplete":
			return foodImport.incomplete;
		case "invalid":
			return foodImport.invalid;
	}
}
