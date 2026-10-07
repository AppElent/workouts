import { router } from "expo-router";
import type { ComboPartReference } from "../../../data/personal-food-repository";

/** A part's food in the food-details sheet, when it still has one. */
export function openComboPartSource(reference: ComboPartReference) {
	if (reference.kind === "oneOff") return;
	router.push({
		pathname: "/nutrition-food-details",
		params: { source: reference.kind, id: reference.foodId },
	});
}
