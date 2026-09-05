/**
 * ============================================================================
 * PLACEHOLDER SEAM — replaced by #70 (goals) and #72 (diary entries).
 * ============================================================================
 *
 * #69 builds the day *shell*: the hierarchy, the navigation, the empty states,
 * the two languages. It deliberately owns no backend. Everything below the
 * types is fixture data, and the whole point of the file is that the fixture
 * can be deleted without the screen changing shape:
 *
 *   - `useNutritionTargets` becomes `useQuery(api.nutritionTargets.list, {})`
 *   - `useNutritionDiary`   becomes `useQuery(api.nutritionDiary.forDate, { date })`
 *
 * Both already return the `undefined`-then-data shape Convex's `useQuery` has,
 * so the screen's loading branch is the real one rather than a rehearsal.
 *
 * The nutrient keys and the value/absent/trace distinction ultimately belong in
 * `@workouts/core` (spec: "core owns pure nutrition rules"). They are declared
 * here for now so that #69 does not race #71 for the same file; the keys are
 * spelled exactly as the spec spells them, `fibre` and all, so the move is a
 * re-export rather than a rename.
 */
import { useEffect, useState } from "react";
import type { IsoDate } from "./calendar-day";

/** The eight nutrients the module stores and shows. Order is display order. */
export const NUTRIENT_KEYS = [
	"energy",
	"protein",
	"carbs",
	"fat",
	"saturatedFat",
	"fibre",
	"sugars",
	"salt",
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** The four diary slots. "Meal" means exactly these, never a Combo. */
export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snacks"] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

/** `min` reads "at least"; `max` reads "no more than". Both are targetable. */
export type GoalDirection = "min" | "max";

export interface NutrientGoal {
	nutrient: NutrientKey;
	direction: GoalDirection;
	/** In the nutrient's own unit: kcal for energy, grams for the rest. */
	target: number;
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

// ---------------------------------------------------------------------------
// Fixture. Everything below here is what #70 and #72 delete.
// ---------------------------------------------------------------------------

/**
 * A plausible targeted set, so the goals-first hierarchy is visible before the
 * goal editor exists. Energy is a maximum by default, which is the spec's
 * choice and the one people find surprising, so it is worth seeing early.
 */
const PLACEHOLDER_GOALS: NutrientGoal[] = [
	{ nutrient: "energy", direction: "max", target: 2100 },
	{ nutrient: "protein", direction: "min", target: 140 },
	{ nutrient: "carbs", direction: "max", target: 230 },
	{ nutrient: "fat", direction: "max", target: 70 },
];

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
	const [state, setState] = useState<NutritionDayState>({ status: "loading" });

	useEffect(() => {
		setState({
			status: "ready",
			day: {
				date,
				goals: PLACEHOLDER_GOALS,
				totals: {},
				entries: NO_ENTRIES,
			},
		});
	}, [date]);

	return state;
}
