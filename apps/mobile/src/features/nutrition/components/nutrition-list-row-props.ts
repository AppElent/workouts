import type { ReactNode } from "react";
import type { RowAction } from "../../../ui/swipeable-row";
import type { FoodRowPosition } from "./food-row-layout";

/** One library item; shared by the iOS and the cross-platform row. */
export interface NutritionListRowProps {
	title: string;
	caption: string;
	/** "389 kcal" */
	value?: string;
	/** "per 100 g" */
	basis?: string;
	leading: ReactNode;
	position: FoodRowPosition;
	/** In selection mode a tap toggles; swipe and the menu step aside. */
	selected?: boolean;
	selectLabel: string;
	actions: readonly RowAction[];
	closeMenuLabel: string;
	onPress: () => void;
}
