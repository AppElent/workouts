import { api } from "@convex/_generated/api";
import {
	calculateOneRepMax,
	convertLoad,
	isoWeekKey,
	isRealIsoDate,
	type LoadUnit,
	type NutrientKey,
	type NutrientValue,
	shiftIsoDate,
	weekStartMonday,
} from "@foundry/core";
import { foodSnapshot } from "@foundry/core/shipped-foods";
import { z } from "zod";
import { MCP_SCOPES } from "../auth";
import {
	type ExerciseProgressResult,
	type FoodLogReviewResult,
	type MacroGoal,
	type MacroKey,
	type Macros,
	PROGRESS_METRICS,
	PROGRESS_RANGES,
	type ProgressRange,
	type WeekActivity,
	type WeekOverviewResult,
} from "../views/types";
import {
	defineTool,
	type FoundryBackend,
	isoDate,
	ToolInputError,
	today,
} from "./define";
import { date, libraryFood, libraryServings, meal } from "./nutrition";
import { allExercises } from "./strength";

const DAY_MS = 86_400_000;
const MACRO_NUTRIENTS = {
	energy: "energyKcal",
	protein: "proteinG",
	carbs: "carbsG",
	fat: "fatG",
} as const satisfies Partial<Record<NutrientKey, MacroKey>>;
type MacroNutrient = keyof typeof MACRO_NUTRIENTS;

function isMacroNutrient(key: string): key is MacroNutrient {
	return key in MACRO_NUTRIENTS;
}

/** Trace counts as zero; a missing figure stays null. */
function figure(value: NutrientValue | undefined): number | null {
	if (!value || value.kind === "absent") return null;
	return value.kind === "trace" ? 0 : value.amount;
}

function macrosOf(
	nutrients: Partial<Record<NutrientKey, NutrientValue>>,
): Macros {
	return {
		energyKcal: figure(nutrients.energy),
		proteinG: figure(nutrients.protein),
		carbsG: figure(nutrients.carbs),
		fatG: figure(nutrients.fat),
	};
}

/** Day totals; a day with nothing logged has no figures. */
function totalMacros(
	totals: Readonly<Record<MacroNutrient, { amount: number }>>,
	entryCount: number,
): Macros {
	const amount = (key: MacroNutrient) =>
		entryCount > 0 ? totals[key].amount : null;
	return {
		energyKcal: amount("energy"),
		proteinG: amount("protein"),
		carbsG: amount("carbs"),
		fatG: amount("fat"),
	};
}

function macroGoals(
	goals: readonly { nutrient: string; direction: string; target: number }[],
): MacroGoal[] {
	return goals.flatMap((goal) =>
		isMacroNutrient(goal.nutrient)
			? [
					{
						macro: MACRO_NUTRIENTS[goal.nutrient],
						direction: goal.direction === "max" ? "max" : "min",
						target: goal.target,
					},
				]
			: [],
	);
}

function startOfDay(day: string) {
	return Date.parse(`${day}T00:00:00Z`);
}

function round1(value: number) {
	return Math.round(value * 10) / 10;
}

async function weekActivities(
	backend: FoundryBackend,
	from: number,
	to: number,
) {
	const activities: WeekActivity[] = [];
	let cursor: string | null = null;
	for (let pages = 0; pages < 5; pages++) {
		const page: Awaited<ReturnType<typeof listActivities>> =
			await listActivities(backend, from, to, cursor);
		for (const item of page.items)
			activities.push({
				...item,
				occurredAt: new Date(item.occurredAt).toISOString(),
			});
		if (page.isDone) break;
		cursor = page.cursor;
	}
	return activities;
}

function listActivities(
	backend: FoundryBackend,
	from: number,
	to: number,
	cursor: string | null,
) {
	return backend.query(api.activities.list, { from, to, limit: 100, cursor });
}

const RANGE_DAYS: Record<ProgressRange, number> = {
	"4w": 28,
	"12w": 84,
	"1y": 365,
};

export const viewTools = [
	defineTool({
		name: "show_week_overview",
		title: "Show week overview",
		description:
			"Show one Monday-to-Sunday week as an interactive view: Strength Sessions, Runs, and Rides per day, and nutrition against goals. Defaults to this week. Days are UTC calendar days.",
		access: "read",
		view: "week-overview",
		input: {
			weekStart: date
				.optional()
				.describe(
					"Any day in the week to show, YYYY-MM-DD; the view starts on its Monday",
				),
		},
		async run({ weekStart }, { backend, now }) {
			const todayDate = today(now());
			if (weekStart !== undefined && !isRealIsoDate(weekStart))
				throw new ToolInputError("weekStart must be a real YYYY-MM-DD date.");
			const start = weekStartMonday(weekStart ?? todayDate);
			const dates = Array.from({ length: 7 }, (_, index) =>
				shiftIsoDate(start, index),
			);
			const [activities, review] = await Promise.all([
				weekActivities(
					backend,
					startOfDay(start),
					startOfDay(shiftIsoDate(start, 7)),
				),
				backend.query(api.nutritionReview.week, {
					startDate: start,
					today: todayDate,
				}),
			]);
			const days = dates.map((day) => {
				const nutrition = review.days.find((entry) => entry.date === day);
				return {
					date: day,
					activities: activities
						.filter((activity) => activity.occurredAt.startsWith(day))
						.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
					nutrition: nutrition
						? {
								entryCount: nutrition.entryCount,
								...totalMacros(nutrition.totals, nutrition.entryCount),
							}
						: {
								entryCount: 0,
								energyKcal: null,
								proteinG: null,
								carbsG: null,
								fatG: null,
							},
					goals: macroGoals(nutrition?.goals ?? []),
				};
			});
			const count = (sport: WeekActivity["sport"]) =>
				activities.filter((activity) => activity.sport === sport).length;
			const result: WeekOverviewResult = {
				view: "week-overview",
				weekStart: start,
				weekEnd: dates[6],
				previousWeekStart: shiftIsoDate(start, -7),
				nextWeekStart: shiftIsoDate(start, 7),
				isCurrentWeek: start === weekStartMonday(todayDate),
				days,
				training: {
					strengthSessions: count("strength"),
					runs: count("running"),
					rides: count("cycling"),
					distanceMeters: activities.reduce(
						(sum, activity) => sum + (activity.distanceMeters ?? 0),
						0,
					),
					durationSeconds: activities.reduce(
						(sum, activity) => sum + activity.durationSeconds,
						0,
					),
				},
				nutrition: {
					loggedDays: days.filter((day) => day.nutrition.entryCount > 0).length,
					energyAverageKcal: review.averages.energy ?? null,
					proteinAverageG: review.averages.protein ?? null,
					goals: days[6].goals,
				},
			};
			return result;
		},
	}),
	defineTool({
		name: "review_food_log",
		title: "Review food log",
		description:
			"Show proposed Nutrition Diary entries as an interactive view before logging: each food with kcal and macros, and the day's totals against goals. The user can change servings, remove items, and log them from the view. Use food IDs and servingIndex values from search_foods. Logs nothing by itself.",
		access: "read",
		view: "food-log",
		input: {
			date,
			meal,
			items: z
				.array(
					z.object({
						foodId: z.string().min(1),
						servingIndex: z.number().int().min(0),
						quantity: z.number().positive().max(10000),
					}),
				)
				.min(1)
				.max(20),
		},
		async run({ date: day, meal, items }, { backend, access }) {
			const [reviewItems, logged, goals] = await Promise.all([
				Promise.all(
					items.map(async (item) => {
						const source = await libraryFood(backend, item.foodId);
						const servings = libraryServings(source);
						if (!servings[item.servingIndex])
							throw new ToolInputError(
								`Unknown servingIndex for ${item.foodId}. Use one from search_foods.`,
							);
						return {
							foodId: item.foodId,
							name: source.food.name.en,
							servingIndex: item.servingIndex,
							quantity: item.quantity,
							servings: servings.map((serving, servingIndex) => ({
								servingIndex,
								label: serving.label.en,
								perQuantity: macrosOf(
									foodSnapshot(source, serving, 1).nutrients,
								),
							})),
						};
					}),
				),
				backend.query(api.nutritionDiary.day, { date: day }),
				backend.query(api.nutritionGoals.forDate, { date: day }),
			]);
			const result: FoodLogReviewResult = {
				view: "food-log",
				date: day,
				meal,
				canLog: access.scopes.has(MCP_SCOPES.write),
				items: reviewItems,
				logged: {
					entryCount: logged.entries.length,
					...totalMacros(logged.totals, logged.entries.length),
				},
				goals: goals.basis === "effective" ? macroGoals(goals.goals) : [],
			};
			return result;
		},
	}),
	defineTool({
		name: "show_exercise_progress",
		title: "Show exercise progress",
		description:
			"Show one Exercise's progress as an interactive view: estimated 1RM or top set per Strength Session, weekly volume, and recorded 1RMs over 4 weeks, 12 weeks, or a year. Warm-ups are left out.",
		access: "read",
		view: "exercise-progress",
		input: {
			exerciseId: z.string().min(1).describe("Exercise ID from list_exercises"),
			range: z.enum(PROGRESS_RANGES).default("12w"),
			metric: z
				.enum(PROGRESS_METRICS)
				.default("e1rm")
				.describe(
					"e1rm: Epley estimate of the best set; topSet: heaviest load",
				),
		},
		async run({ exerciseId, range, metric }, { backend, now }) {
			const [exercises, history, volume, records] = await Promise.all([
				allExercises(backend),
				backend.query(api.exercises.getHistory, { exerciseId }),
				backend.query(api.progress.weeklyVolume, {
					exerciseId,
					utcOffsetMinutes: 0,
				}),
				backend.query(api.oneRepMaxes.listForExercise, { exerciseId }),
			]);
			const exercise = exercises.find((entry) => entry._id === exerciseId);
			if (!exercise)
				throw new ToolInputError(
					"Exercise not found. Use an ID from list_exercises.",
				);
			const fromMs = now().getTime() - RANGE_DAYS[range] * DAY_MS;
			const from = new Date(fromMs).toISOString().slice(0, 10);
			const unit: LoadUnit =
				history.at(-1)?.unit ?? records.at(-1)?.unit ?? "kg";
			const sessions = new Map<
				string,
				{ date: string; value: number; weight: number; reps: number }
			>();
			for (const set of history) {
				if (set.loggedAt < fromMs || set.setType === "warmup") continue;
				if (set.reps < 1 || set.weight <= 0) continue;
				const weight = round1(convertLoad(set.weight, set.unit, unit));
				const value =
					metric === "e1rm"
						? calculateOneRepMax(weight, set.reps).value
						: weight;
				const best = sessions.get(set.sessionId);
				if (
					best &&
					(best.value > value ||
						(best.value === value && best.reps >= set.reps))
				)
					continue;
				sessions.set(set.sessionId, {
					date: new Date(set.sessionDate).toISOString().slice(0, 10),
					value,
					weight,
					reps: set.reps,
				});
			}
			const points = [...sessions.values()].sort((a, b) =>
				a.date.localeCompare(b.date),
			);
			const values = points.map((point) => point.value);
			const fromWeek = isoWeekKey(from);
			const result: ExerciseProgressResult = {
				view: "exercise-progress",
				exercise: { id: exerciseId, name: exercise.name },
				range,
				metric,
				from,
				unit,
				points,
				weeklyVolume: volume
					.filter((week) => week.week >= fromWeek)
					.map((week) => ({
						week: week.week,
						volume: Math.round(convertLoad(week.volume, "kg", unit)),
					})),
				oneRepMaxes: records
					.filter((record) => record.date >= fromMs)
					.sort((a, b) => a.date - b.date)
					.map((record) => ({
						date: isoDate(record.date)?.slice(0, 10) ?? from,
						value: record.value,
						unit: record.unit,
						source: record.source,
					})),
				summary: {
					sessions: points.length,
					latest: values.at(-1) ?? null,
					best: values.length ? Math.max(...values) : null,
					change:
						values.length >= 2
							? round1((values.at(-1) ?? 0) - values[0])
							: null,
				},
			};
			return result;
		},
	}),
];
