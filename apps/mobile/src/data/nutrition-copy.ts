import type { NutritionDiarySnapshot } from "@workouts/core";
import { shiftIsoDate } from "./calendar-day";
import type { DiaryEntry, MealSlot } from "./nutrition-day";

export function previousCalendarDay(date: string): string {
	return shiftIsoDate(date, -1);
}

export function copyMealEntries(
	entries: readonly DiaryEntry[],
	targetDate: string,
	targetMeal: MealSlot,
	mintId: () => string,
): Array<NutritionDiarySnapshot & { clientEntryId: string }> {
	const comboGroups = new Map<
		string,
		{ id: string; comboId: string; name: string }
	>();
	return entries.map((entry) => {
		const group = entry.comboGroup;
		const copiedGroup = group
			? (comboGroups.get(group.id) ?? {
					id: mintId(),
					comboId: group.comboId,
					name: group.name,
				})
			: undefined;
		if (group && copiedGroup) comboGroups.set(group.id, copiedGroup);
		return {
			clientEntryId: mintId(),
			name: entry.name,
			serving: entry.serving,
			quantity: entry.quantity,
			amount: entry.amount,
			baseUnit: entry.baseUnit,
			nutrients: entry.nutrients,
			provenance: entry.provenance,
			...(copiedGroup ? { comboGroup: copiedGroup } : {}),
			date: targetDate,
			meal: targetMeal,
		};
	});
}
