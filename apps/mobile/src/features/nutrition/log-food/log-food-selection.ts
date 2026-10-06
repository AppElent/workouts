import {
	formatServingSelection,
	NUTRIENT_KEYS,
	NUTRIENT_UNITS,
	type NutrientValue,
	personalFoodServingOptions,
	personalFoodSnapshot,
	previewServing,
	roundForDisplay,
	type ServingOption,
	type ShippedFood,
	servingOptions,
	shippedSourceMeta,
	withPersonalMeasures,
	withSupplementaryServings,
} from "@workouts/core/nutrition";
import type { DiaryEntry, MealSlot } from "../../../data/nutrition-day";
import type { PersonalFood } from "../../../data/personal-food-repository";
import type { FoodBrowserTab } from "./log-food-copy";

export type FoodSelection =
	| { readonly kind: "shipped"; readonly food: ShippedFood }
	| { readonly kind: "personal"; readonly food: PersonalFood };

export type LogOutcome = "continue" | "close";
export type FoodFilter = FoodBrowserTab;

export function formatNutrient(
	value: NutrientValue,
	key: (typeof NUTRIENT_KEYS)[number],
	messages: { trace: string; absent: string },
): string {
	if (value.kind === "trace") return messages.trace;
	if (value.kind === "absent") return messages.absent;
	return `${roundForDisplay(key, value.amount)} ${NUTRIENT_UNITS[key]}`;
}

export function servingChoices(
	selection: FoodSelection,
	personalMeasures: readonly import("@workouts/core/nutrition").PersonalMeasure[],
	supplementary: readonly import("@workouts/core/nutrition").SupplementaryServing[] = [],
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
	locale: "en" | "nl",
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

export function createFoodSnapshot(
	selection: FoodSelection,
	selectedServing: ServingOption,
	quantity: number,
	date: string,
	meal: MealSlot,
	clientEntryId: string,
	locale: "en" | "nl",
) {
	if (selection.kind === "personal") {
		const { provenance, ...snapshot } = personalFoodSnapshot(selection.food, {
			quantity,
			serving: selectedServing,
			date,
			meal,
		});
		return {
			common: {
				...snapshot,
				clientEntryId,
				...(selectedServing.kind === "personal-measure"
					? { personalMeasureId: selectedServing.id }
					: {}),
			},
			provenance,
		};
	}
	const preview = servingPreview(selection, selectedServing, quantity, locale);
	const common = {
		date,
		meal,
		clientEntryId,
		name: selection.food.name,
		serving: {
			en: formatServingSelection(selectedServing, quantity, "en"),
			nl: formatServingSelection(selectedServing, quantity, "nl"),
		},
		quantity,
		amount: preview.amount,
		baseUnit: selection.food.baseUnit,
		...(selectedServing.kind === "personal-measure"
			? { personalMeasureId: selectedServing.id }
			: {}),
		nutrients: Object.fromEntries(
			NUTRIENT_KEYS.map((key) => [key, preview.nutrients[key]]),
		) as Pick<ShippedFood["nutrients"], (typeof NUTRIENT_KEYS)[number]>,
	};
	const source = shippedSourceMeta(selection.food);
	const provenance: DiaryEntry["provenance"] = {
		source: "shipped",
		sourceId: selection.food.id,
		dataset: source.name,
		edition: source.edition,
		sourceCode: selection.food.code,
		sourceName: selection.food.sourceName,
		saltDerived: source.saltDerived,
	};
	return { common, provenance };
}
