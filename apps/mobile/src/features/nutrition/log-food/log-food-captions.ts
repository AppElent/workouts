import {
	type FoodResult,
	type NutrientKey,
	type NutrientValue,
	roundForDisplay,
} from "@workouts/core/nutrition";
import type {
	OffLookupOutcome,
	OffSearchOutcome,
} from "../../../data/open-food-facts";
import type {
	Combo,
	PersonalFood,
} from "../../../data/personal-food-repository";
import { fmt, type Messages } from "../../../i18n";

import type { servingPreview } from "./log-food-selection";

/**
 * A Combo's own kcal, summed from the snapshots it was saved with.
 *
 * A part's `nutrients` are already the figures for the amount that part logs —
 * the same values the diary prints per entry — so this sums them rather than
 * rescaling by `quantity`.
 */
export function comboEnergy(combo: Combo): number | undefined {
	let total = 0;
	let known = false;
	for (const part of combo.parts) {
		const energy = part.snapshot.nutrients.energy;
		if (energy.kind !== "value") continue;
		known = true;
		total += energy.amount;
	}
	return known ? roundForDisplay("energy", total) : undefined;
}

/**
 * The line under a result's name.
 *
 * Two of the four cases exist for #75: a correction says so, and — in the
 * deliberate broader view, the only place it is still listed — so does the
 * shipped record it replaced. Neither ever hides the other.
 *
 * #75 left a rule for whoever came next: if this reaches six cases it should
 * become a core function returning a caption *kind* that the screen
 * translates, rather than a screen-local function handed the whole message
 * tree. Checked at #79 — still four. #76's import captions went to the online
 * results list, which renders its provider line directly and never comes
 * through here, so the count did not move. Left as it is: at four one-line
 * branches the indirection would cost a hop through core and buy nothing.
 */
export function resultCaption(
	result: FoodResult<PersonalFood>,
	messages: Messages["nutrition"],
	locale: "en" | "nl",
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

export function resultEnergyCaption(
	food: {
		nutrients: Record<NutrientKey, NutrientValue>;
		baseUnit: "g" | "ml" | "serving";
	},
	messages: Messages["nutrition"],
	locale: "en" | "nl",
): string {
	const energy = food.nutrients.energy;
	const unit = food.baseUnit;
	if (unit === "serving") {
		const amount =
			energy.kind === "value"
				? `${roundForDisplay("energy", energy.amount)} kcal`
				: energy.kind === "trace"
					? "~0 kcal"
					: "— kcal";
		return `${amount} / ${locale === "nl" ? "portie" : "serving"}`;
	}
	if (energy.kind === "value") {
		return fmt(messages.foodBrowser.energyPer100, {
			amount: roundForDisplay("energy", energy.amount),
			unit,
		});
	}
	return energy.kind === "trace"
		? fmt(messages.foodBrowser.energyTracePer100, { unit })
		: fmt(messages.foodBrowser.energyUnavailablePer100, { unit });
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
