import { router } from "expo-router";
import type { ComboPartReference } from "../../../data/personal-food-repository";

/** Where a part's food can be read, when it still has one. */
export function openComboPartSource(reference: ComboPartReference) {
	if (reference.kind === "personal")
		router.push({
			pathname: "/personal-food/[id]",
			params: { id: reference.foodId },
		});
	else if (reference.kind === "shipped")
		router.push({
			pathname: "/nutrition-food-details",
			params: { source: "shipped", id: reference.foodId },
		});
}
