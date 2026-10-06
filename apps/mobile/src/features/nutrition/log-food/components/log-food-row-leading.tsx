import { FoodVisualView } from "../../../../ui/food-visual";
import type { FoodSelection } from "../log-food-selection";
import { LogFoodMediaSlot, MEDIA_SLOT } from "./log-food-media-slot";

/** A food's tile: its own visual, a legacy photo, or the catalogue emoji. */
export function LogFoodRowLeading({
	selection,
	locale,
}: {
	selection: FoodSelection;
	locale: "en" | "nl";
}) {
	const name = selection.food.name[locale];
	const legacyImageUrl =
		selection.kind === "personal" &&
		selection.food.visualMigrationPending &&
		!selection.food.visual
			? selection.food.provenance.imageUrl
			: undefined;
	if (selection.kind === "personal" && !legacyImageUrl)
		return (
			<FoodVisualView
				visual={selection.food.visual}
				label={name}
				size={MEDIA_SLOT}
			/>
		);
	return (
		<LogFoodMediaSlot
			imageUrl={legacyImageUrl}
			emoji={selection.kind === "shipped" ? selection.food.emoji : undefined}
			label={name}
			symbol={{ ios: "fork.knife", android: "restaurant", web: "restaurant" }}
		/>
	);
}
