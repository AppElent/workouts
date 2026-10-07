import {
	baseUnitServingOption,
	getShippedFood,
	personalFoodServingOptions,
	type ServingOption,
	servingOptions,
	withPersonalMeasures,
	withSupplementaryServings,
} from "@workouts/core/nutrition";
import { usePersonalFoods } from "../../data/personal-foods";
import { usePersonalMeasures } from "../../data/personal-measures";
import { useSupplementaryServings } from "../../data/supplementary-servings";
import type { AmountServings } from "./components/amount-editor";

/** What a saved amount remembers: a diary entry or a combo part. */
export type AmountSnapshot = {
	readonly serving: { readonly en: string; readonly nl: string };
	readonly quantity: number;
	readonly amount: number;
	readonly baseUnit: "g" | "ml" | "serving";
	readonly provenance:
		| {
				readonly source: "shipped" | "personal" | "import";
				readonly sourceId: string;
		  }
		| { readonly source: "oneOff" };
};

/**
 * The servings a saved amount can switch to: its food's own (while the food
 * still exists with the same unit), added servings, personal measures, and
 * the serving it was saved with, so keeping it is always a choice.
 */
export function useSnapshotServings(
	snapshot: AmountSnapshot,
): AmountServings & { readonly historical: ServingOption } {
	const foods = usePersonalFoods();
	const measures = usePersonalMeasures();
	const { provenance } = snapshot;
	const shippedId =
		provenance.source === "shipped" ? provenance.sourceId : undefined;
	const source =
		provenance.source === "shipped"
			? getShippedFood(provenance.sourceId)
			: provenance.source === "personal" || provenance.source === "import"
				? foods.find(provenance.sourceId)
				: undefined;
	const additions = useSupplementaryServings(shippedId);
	const authored: ServingOption[] =
		source && source.baseUnit === snapshot.baseUnit
			? "provenance" in source
				? personalFoodServingOptions(source)
				: servingOptions(source)
			: [baseUnitServingOption(snapshot.baseUnit)];
	const choices = withPersonalMeasures(
		withSupplementaryServings(
			authored,
			shippedId,
			snapshot.baseUnit,
			additions.servings,
		),
		snapshot.baseUnit,
		measures,
	);
	// Saved by weight or volume, the amount is simply in the base unit, which
	// steps by tens; anything else is kept as the serving it was saved with.
	const baseUnit = choices.find((choice) => choice.kind === "base-unit");
	const historical: ServingOption =
		baseUnit &&
		snapshot.baseUnit !== "serving" &&
		snapshot.amount / snapshot.quantity === 1
			? baseUnit
			: {
					kind: "authored",
					index: -1,
					amount: snapshot.amount / snapshot.quantity,
					label: {
						en: snapshot.serving.en.replace(/ × .*$/, ""),
						nl: snapshot.serving.nl.replace(/ × .*$/, ""),
					},
				};
	return { source, additions, choices, historical };
}
