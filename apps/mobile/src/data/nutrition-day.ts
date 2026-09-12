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
	type NutrientTotal,
	type NutrientValue,
	type NutritionGoalValue,
} from "@workouts/core/nutrition";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "../convex/api";
import type { IsoDate } from "./calendar-day";
import {
	useNutritionOperations,
	useNutritionOperationVersion,
} from "./nutrition-operation-service";
import type { ComboSnapshotProvenance } from "./personal-food-repository";

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
	pendingOperationId?: string;
	name: { en: string; nl: string };
	/** "1 bowl (250 g)" — serving name × quantity, already formatted. */
	serving: { en: string; nl: string };
	nutrients: Record<NutrientKey, NutrientValue>;
	/** The number of servings logged — what a quantity edit rescales from. */
	quantity: number;
	amount: number;
	baseUnit: "g" | "ml";
	provenance: ComboSnapshotProvenance;
	comboGroup?: { id: string; comboId: string; name: string };
}

export interface NutritionDay {
	date: IsoDate;
	complete: boolean;
	goals: NutrientGoal[];
	goalBasis?: "effective" | "reference";
	goalsCached?: boolean;
	/** Day totals per nutrient. Absent from the map means "nothing logged". */
	totals: Partial<Record<NutrientKey, NutrientTotal>>;
	entries: Record<MealSlot, DiaryEntry[]>;
	pendingOperationIds: readonly string[];
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

/**
 * Resolves on the render after mount, which is the shape `useQuery` has: it
 * returns `undefined` first and data second. Building the screen against that
 * from the start is what makes the skeleton a real branch instead of a mock-up.
 */
export function useNutritionDay(date: IsoDate): NutritionDayState {
	const goalHistory = useQuery(api.nutritionGoals.forDate, { date });
	const diary = useQuery(api.nutritionDiary.day, { date });
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const subject = operations.getSubject();
	const cachedGoals = subject ? operations.getGoals(subject, date) : undefined;
	const history = goalHistory ?? cachedGoals;
	const goals = history?.goals;
	const local = subject ? operations.getProjectedDay(subject, date) : undefined;
	const remoteRevision = diary?.revision ?? 0;
	useEffect(() => {
		if (subject && goalHistory)
			operations.cacheGoals(subject, date, goalHistory);
	}, [operations, subject, date, goalHistory]);
	useEffect(() => {
		if (!subject || !diary) return;
		operations.cacheServerDay(subject, {
			date,
			revision: remoteRevision,
			entries: diary.entries as never,
			totals: diary.totals,
		});
	}, [date, diary, operations, remoteRevision, subject]);
	if (goals === undefined && !local?.complete && !local?.entries.length)
		return { status: "loading" };
	if (diary === undefined && !local?.complete && !local?.entries.length) {
		return { status: "loading" };
	}
	const entries = {
		breakfast: [],
		lunch: [],
		dinner: [],
		snacks: [],
	} as Record<MealSlot, DiaryEntry[]>;
	const hasPendingOperations = (local?.pendingOperationIds.length ?? 0) > 0;
	const useLocal =
		hasPendingOperations ||
		diary === undefined ||
		(local?.revision ?? -1) > remoteRevision;
	const sourceEntries = useLocal
		? (local?.entries ?? [])
		: (diary?.entries ?? []);
	for (const entry of sourceEntries) {
		entries[entry.meal].push({
			id: String(entry._id),
			name: entry.name,
			serving: entry.serving,
			nutrients: entry.nutrients,
			quantity: entry.quantity,
			amount: entry.amount,
			baseUnit: entry.baseUnit,
			provenance: entry.provenance,
			comboGroup: entry.comboGroup,
			pendingOperationId:
				"pendingOperationId" in entry ? entry.pendingOperationId : undefined,
		});
	}
	return {
		status: "ready",
		day: {
			date,
			complete: local?.complete || diary !== undefined,
			goals: goals ?? [],
			goalBasis: history?.basis,
			goalsCached: !goalHistory && !!cachedGoals,
			totals: useLocal ? (local?.totals ?? {}) : (diary?.totals ?? {}),
			entries,
			pendingOperationIds: local?.pendingOperationIds ?? [],
		},
	};
}
