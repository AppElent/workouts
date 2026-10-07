import type { NutritionMealSlot } from "./operations";

/**
 * The meal a moment most likely belongs to, as a default destination. Time
 * between meals and late at night counts as snacks.
 */
export function mealSlotAt(moment: Date): NutritionMealSlot {
	const minutes = moment.getHours() * 60 + moment.getMinutes();
	if (minutes >= 5 * 60 && minutes < 10 * 60 + 30) return "breakfast";
	if (minutes >= 11 * 60 + 30 && minutes < 14 * 60 + 30) return "lunch";
	if (minutes >= 17 * 60 && minutes < 21 * 60) return "dinner";
	return "snacks";
}
