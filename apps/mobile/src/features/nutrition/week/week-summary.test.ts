import type { NutrientKey } from "@workouts/core/nutrition";
import {
	emptyReviewTotals,
	type WeeklyGoal,
	type WeeklyReviewDay,
} from "../../../data/nutrition-weekly-review";
import {
	isoWeekNumber,
	weekAverage,
	weekDayStatus,
	weekGoalChanges,
	weekGoalCount,
	weekStripWeeks,
	weekTitleKind,
	worstGoal,
} from "./week-summary";

const fatMax: WeeklyGoal = { nutrient: "fat", direction: "max", target: 80 };
const proteinMin: WeeklyGoal = {
	nutrient: "protein",
	direction: "min",
	target: 120,
};

function day(
	date: string,
	amounts: Partial<Record<NutrientKey, number>>,
	options: {
		goals?: WeeklyGoal[];
		incomplete?: NutrientKey[];
		effectiveFrom?: string | null;
		entryCount?: number;
	} = {},
): WeeklyReviewDay {
	const totals = emptyReviewTotals();
	for (const [key, amount] of Object.entries(amounts))
		totals[key as NutrientKey] = {
			...totals[key as NutrientKey],
			amount: amount as number,
			incomplete: options.incomplete?.includes(key as NutrientKey) ?? false,
		};
	const goals = options.goals ?? [fatMax, proteinMin];
	return {
		date,
		entryCount: options.entryCount ?? (Object.keys(amounts).length ? 5 : 0),
		totals,
		goals,
		goalBasis: goals.length ? "effective" : "reference",
		effectiveFrom:
			options.effectiveFrom === undefined
				? goals.length
					? "2026-09-12"
					: null
				: options.effectiveFrom,
	};
}

const today = "2026-10-02";
const week = [
	day("2026-09-28", { fat: 70, protein: 130 }),
	day("2026-09-29", { fat: 95, protein: 100 }),
	day("2026-09-30", { fat: 60, protein: 90 }, { incomplete: ["fat"] }),
	day("2026-10-01", { fat: 90, protein: 125 }),
	day("2026-10-02", { fat: 20, protein: 30 }),
	day("2026-10-03", {}),
	day("2026-10-04", {}),
];

describe("week summary", () => {
	it("gives each day a status against the goal that applied", () => {
		expect(week.map((item) => weekDayStatus(item, "fat", today))).toEqual([
			"ok",
			"over",
			"incomplete",
			"over",
			"today",
			"future",
			"future",
		]);
		expect(weekDayStatus(week[1], "protein", today)).toBe("below");
		expect(
			weekDayStatus(
				day("2026-09-28", { fat: 70 }, { goals: [] }),
				"fat",
				today,
			),
		).toBe("noGoal");
		expect(weekDayStatus(day("2026-09-27", {}), "fat", today)).toBe("empty");
	});

	it("averages closed, complete days only", () => {
		expect(weekAverage(week, "fat", today)).toEqual({ value: 85, days: 3 });
		expect(weekAverage(week, "protein", today)).toEqual({
			value: (130 + 100 + 90 + 125) / 4,
			days: 4,
		});
	});

	it("counts days against the goal and leaves out days without one", () => {
		expect(weekGoalCount(week, "fat", today)).toEqual({
			kind: "over",
			count: 2,
			of: 3,
			incomplete: 1,
		});
		expect(weekGoalCount(week, "protein", today)).toEqual({
			kind: "aboveMinimum",
			count: 2,
			of: 4,
			incomplete: 0,
		});
	});

	it("names the goal missed most often", () => {
		expect(worstGoal(week, today)).toEqual({
			nutrient: "fat",
			kind: "over",
			count: 2,
		});
	});

	it("reports where a goal changes inside the week", () => {
		const energy = (target: number): WeeklyGoal => ({
			nutrient: "energy",
			direction: "max",
			target,
		});
		const changed = [
			day("2026-09-28", { energy: 1 }, { goals: [energy(2700)] }),
			day("2026-09-29", { energy: 1 }, { goals: [energy(2700)] }),
			day(
				"2026-09-30",
				{ energy: 1 },
				{ goals: [energy(2500)], effectiveFrom: "2026-09-30" },
			),
		];
		expect(weekGoalChanges(changed)).toEqual([
			{ date: "2026-09-30", kind: "changed" },
		]);
		const started = [
			day("2026-09-28", { energy: 1 }, { goals: [] }),
			day(
				"2026-09-29",
				{ energy: 1 },
				{ goals: [energy(2500)], effectiveFrom: "2026-09-29" },
			),
		];
		expect(weekGoalChanges(started)).toEqual([
			{ date: "2026-09-29", kind: "started" },
		]);
	});

	it("titles and numbers weeks", () => {
		expect(isoWeekNumber("2026-09-28")).toBe(40);
		expect(isoWeekNumber("2027-01-01")).toBe(53);
		expect(weekTitleKind("2026-09-28", "2026-10-02")).toBe("current");
		expect(weekTitleKind("2026-09-21", "2026-10-02")).toBe("previous");
		expect(weekTitleKind("2026-08-24", "2026-10-02")).toBe("numbered");
	});

	it("shows recent weeks that end at the current week", () => {
		expect(weekStripWeeks("2026-09-28", "2026-10-02")).toEqual([
			"2026-08-31",
			"2026-09-07",
			"2026-09-14",
			"2026-09-21",
			"2026-09-28",
		]);
		expect(weekStripWeeks("2026-08-24", "2026-10-02")).toEqual([
			"2026-08-10",
			"2026-08-17",
			"2026-08-24",
			"2026-08-31",
			"2026-09-07",
		]);
	});
});
