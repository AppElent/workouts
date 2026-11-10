/**
 * Effective-dated goals and frozen diary entries come from Convex. The last
 * answer per date stays in session memory, so returning to a day shows it at
 * once while its subscription starts again.
 */
import {
	type GoalPresetKey,
	type MealSlot,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientTotal,
	type NutritionDiarySnapshot,
	type NutritionGoalValue,
} from "@foundry/core";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect } from "react";
import { api } from "../convex/api";
import { useQuery } from "../convex/query-cache";
import type { IsoDate } from "../dates/calendar-day";
import { accountSlot, useAccountSlot } from "./account-write";

export interface NutrientGoal extends NutritionGoalValue {
	sourcePreset?: GoalPresetKey;
}

export type DiaryEntry = Omit<NutritionDiarySnapshot, "date" | "meal"> & {
	readonly id: string;
};

/** Keeps the source Meal Slot when entries are selected across the day. */
export type DiaryEntryWithMeal = DiaryEntry & { meal: MealSlot };

export interface NutritionDay {
	date: IsoDate;
	/** False while only this session's last copy of the day is shown. */
	complete: boolean;
	goals: NutrientGoal[];
	displayOrder: readonly NutrientKey[];
	goalBasis?: "effective" | "reference";
	goalsCached?: boolean;
	/** Diary entries can be available before this date's goals arrive. */
	goalsPending?: boolean;
	/** Day totals per nutrient. Absent from the map means "nothing logged". */
	totals: Partial<Record<NutrientKey, NutrientTotal>>;
	entries: Record<MealSlot, DiaryEntry[]>;
}

export type NutritionDayState =
	| { status: "loading" }
	| { status: "ready"; day: NutritionDay };

type ServerDay = FunctionReturnType<typeof api.nutritionDiary.day>;
type ServerGoals = FunctionReturnType<typeof api.nutritionGoals.forDate>;

const RETAINED_DATES = 32;

function retained<T>() {
	const values = new Map<string, T>();
	return {
		get: (key: string) => values.get(key),
		set(key: string, value: T) {
			values.delete(key);
			values.set(key, value);
			const oldest = values.keys().next().value;
			if (values.size > RETAINED_DATES && oldest !== undefined)
				values.delete(oldest);
		},
	};
}

const DAYS = accountSlot(() => retained<ServerDay>());
const GOALS = accountSlot(() => retained<ServerGoals>());

export function useSetNutritionDisplayOrder() {
	const setDisplayOrder = useMutation(api.nutritionGoals.setDisplayOrder);
	return (displayOrder: readonly NutrientKey[]) =>
		setDisplayOrder({ displayOrder: [...displayOrder] });
}

export function diaryEntryFromServer(
	entry: ServerDay["entries"][number],
): DiaryEntry & { meal: MealSlot } {
	const {
		_id,
		_creationTime: _created,
		userId: _user,
		loggedAt: _loggedAt,
		date: _date,
		...snapshot
	} = entry;
	return { ...snapshot, id: String(_id) };
}

/** The entry as a new snapshot for another day or meal, without its identity. */
export function snapshotFromDiaryEntry(
	entry: DiaryEntry,
	date: string,
	meal: MealSlot,
): NutritionDiarySnapshot {
	const { id: _id, clientEntryId: _clientEntryId, ...snapshot } = entry;
	return { ...snapshot, date, meal };
}

export function useNutritionDay(date: IsoDate): NutritionDayState {
	const goalHistory = useQuery(api.nutritionGoals.forDate, { date });
	const diary = useQuery(api.nutritionDiary.day, { date });
	const days = useAccountSlot(DAYS);
	const goalCache = useAccountSlot(GOALS);
	useEffect(() => {
		if (goalHistory) goalCache.set(date, goalHistory);
	}, [goalCache, date, goalHistory]);
	useEffect(() => {
		if (diary) days.set(date, diary);
	}, [days, date, diary]);
	const cachedGoals = goalCache.get(date);
	const history = goalHistory ?? cachedGoals;
	const day = diary ?? days.get(date);
	if (!day) return { status: "loading" };
	const entries: Record<MealSlot, DiaryEntry[]> = {
		breakfast: [],
		lunch: [],
		dinner: [],
		snacks: [],
	};
	for (const entry of day.entries) {
		const { meal, ...diaryEntry } = diaryEntryFromServer(entry);
		entries[meal].push(diaryEntry);
	}
	return {
		status: "ready",
		day: {
			date,
			complete: diary !== undefined,
			goals: history?.goals ?? [],
			displayOrder: history?.displayOrder ?? NUTRIENT_KEYS,
			goalBasis: history?.basis,
			goalsCached: !goalHistory && !!cachedGoals,
			goalsPending: history === undefined,
			totals: day.totals,
			entries,
		},
	};
}
