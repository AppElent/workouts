/**
 * Nutrition-day data boundary.
 *
 * Current goals come from Convex and deliberately apply to every selected day.
 * Diary entries remain the #72 seam. Shared nutrient and goal vocabulary comes
 * from `@workouts/core/nutrition` so every client and backend uses one contract.
 */
import {
	type GoalDirection,
	type GoalPresetKey,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutritionGoalValue,
} from "@workouts/core/nutrition";
import { useQuery } from "convex/react";
import { api } from "../convex/api";
import type { IsoDate } from "./calendar-day";

/** The eight nutrients the module stores and shows. Order is display order. */
export { NUTRIENT_KEYS, type NutrientKey };

/** The four diary slots. "Meal" means exactly these, never a Combo. */
export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snacks"] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

/** `min` reads "at least"; `max` reads "no more than". Both are targetable. */
export type { GoalDirection };

export interface NutrientGoal extends NutritionGoalValue {
	sourcePreset?: GoalPresetKey;
}

export interface DiaryEntry {
	id: string;
	name: string;
	/** "1 bowl (250 g)" — serving name × quantity, already formatted. */
	serving: string;
	energy: number;
}

export interface NutritionDay {
	date: IsoDate;
	goals: NutrientGoal[];
	/** Day totals per nutrient. Absent from the map means "nothing logged". */
	totals: Partial<Record<NutrientKey, number>>;
	entries: Record<MealSlot, DiaryEntry[]>;
}

export type NutritionDayState =
	| { status: "loading" }
	| { status: "ready"; day: NutritionDay };

/**
 * How a total sits against its goal, as a word rather than a colour.
 *
 * Zero is neutral, not failure: a day nobody has logged yet must not read as
 * "under" on every minimum and "within" on every maximum, or the screen
 * congratulates and scolds an empty diary. A minimum distinguishes under from
 * met; a maximum distinguishes within from exceeded. Those are four different
 * words precisely because colour cannot be the only signal.
 */
export type GoalState = "neutral" | "under" | "met" | "within" | "exceeded";

export function goalState(
	direction: GoalDirection,
	total: number | undefined,
	target: number,
): GoalState {
	if (total === undefined || total === 0) return "neutral";
	if (direction === "min") return total >= target ? "met" : "under";
	return total > target ? "exceeded" : "within";
}

/** kcal for energy, grams for everything else. */
export function nutrientUnit(nutrient: NutrientKey): "kcal" | "g" {
	return nutrient === "energy" ? "kcal" : "g";
}

const NO_ENTRIES: Record<MealSlot, DiaryEntry[]> = {
	breakfast: [],
	lunch: [],
	dinner: [],
	snacks: [],
};

/**
 * Resolves on the render after mount, which is the shape `useQuery` has: it
 * returns `undefined` first and data second. Building the screen against that
 * from the start is what makes the skeleton a real branch instead of a mock-up.
 */
export function useNutritionDay(date: IsoDate): NutritionDayState {
	const goals = useQuery(api.nutritionGoals.list, {});
	if (goals === undefined) return { status: "loading" };
	return {
		status: "ready",
		day: { date, goals, totals: {}, entries: NO_ENTRIES },
	};
}
