import {
	getShippedFood,
	personalFoodServingOptions,
	type ServingOption,
	servingOptions,
	withPersonalMeasures,
	withSupplementaryServings,
} from "@workouts/core/nutrition";
import { usePersonalFoods } from "../../../data/personal-foods";
import { usePersonalMeasures } from "../../../data/personal-measures";
import { useSupplementaryServings } from "../../../data/supplementary-servings";

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
export function useSnapshotServings(snapshot: AmountSnapshot) {
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
			: [
					{
						kind: "base-unit",
						amount: 1,
						unit: snapshot.baseUnit,
						label: {
							en:
								snapshot.baseUnit === "ml"
									? "Millilitre (ml)"
									: snapshot.baseUnit === "g"
										? "Gram (g)"
										: "Serving",
							nl:
								snapshot.baseUnit === "ml"
									? "Milliliter (ml)"
									: snapshot.baseUnit === "g"
										? "Gram (g)"
										: "Portie",
						},
					},
				];
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
	const historical: ServingOption = {
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
