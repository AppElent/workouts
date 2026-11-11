import type { MealSlot } from "@foundry/core";
import { useRef } from "react";
import { useNutritionDay } from "../../../data/nutrition-day";

/**
 * The diary entry a route edits, kept once found so the screen stays mounted
 * while its own optimistic meal or date move takes it off this day.
 */
export function useRetainedDiaryEntry(
	date: string,
	meal: MealSlot,
	id: string | undefined,
) {
	const state = useNutritionDay(date);
	const current =
		state.status === "ready"
			? state.day.entries[meal].find((entry) => entry.id === id)
			: undefined;
	const retained = useRef(current);
	if (!retained.current && current) retained.current = current;
	return { entry: retained.current, loading: state.status === "loading" };
}
