import type { MealSlot } from "../../../../data/nutrition-day";

/**
 * The title as the destination: which meal on which day a log goes into.
 * Meal and day are one "where to", so they share one control (the same idiom
 * as the diary's meal menu) instead of a chip row plus a date button.
 */
export interface LogFoodDestinationMenuProps {
	/** Spoken name of the control, including the current meal and day. */
	label: string;
	mealName: string;
	dayLabel: string;
	sectionTitle: string;
	closeLabel: string;
	otherDayLabel: string;
	options: readonly {
		readonly slot: MealSlot;
		/** The meal's name. */
		readonly label: string;
		/** What is in it, such as "2 items · 322 kcal", or "nog niets". */
		readonly detail: string;
		readonly selected: boolean;
	}[];
	onSelectMeal: (slot: MealSlot) => void;
	onOtherDay: () => void;
}
