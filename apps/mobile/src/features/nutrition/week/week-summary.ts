import {
	evaluateGoal,
	type GoalBounds,
	goalBounds,
	type IsoDate,
	type NutrientKey,
	shiftIsoDate,
	weekStartMonday,
} from "@foundry/core";
import { HEADLINE_NUTRIENTS } from "../use-nutrient-fields";
import type { WeeklyReviewDay } from "./weekly-review";

/**
 * How one day did against the goal that applied on that day. Shape and
 * colour carry it in the week view, so every status is distinct.
 */
export type WeekDayStatus =
	| "ok"
	| "below"
	| "over"
	| "incomplete"
	| "noGoal"
	| "today"
	| "empty"
	| "future";

/** The four goals the week view puts in front. */
export const WEEK_NUTRIENTS = HEADLINE_NUTRIENTS;

function goalsFor(day: WeeklyReviewDay, nutrient: NutrientKey) {
	return day.goalBasis === "effective"
		? day.goals.filter((goal) => goal.nutrient === nutrient)
		: [];
}

export function dayGoalBounds(
	day: WeeklyReviewDay,
	nutrient: NutrientKey,
): GoalBounds | undefined {
	return goalBounds(goalsFor(day, nutrient), [nutrient])[0];
}

export function weekDayStatus(
	day: WeeklyReviewDay,
	nutrient: NutrientKey,
	today: IsoDate,
): WeekDayStatus {
	if (day.date > today) return "future";
	if (day.date === today) return "today";
	if (day.entryCount === 0) return "empty";
	const bounds = dayGoalBounds(day, nutrient);
	if (!bounds) return "noGoal";
	const { status } = evaluateGoal(bounds, day.totals[nutrient]);
	if (status === "exceeded") return "over";
	if (status === "below") return "below";
	if (status === "incomplete") return "incomplete";
	return "ok";
}

export type WeekGoalCount = {
	/** What `count` counts: days over a maximum, above a minimum, or within. */
	kind: "over" | "aboveMinimum" | "within";
	count: number;
	/** Closed, complete days that had a goal. */
	of: number;
	/** Closed days left out because a value was missing. */
	incomplete: number;
};

export function weekGoalCount(
	days: readonly WeeklyReviewDay[],
	nutrient: NutrientKey,
	today: IsoDate,
): WeekGoalCount | undefined {
	const statuses = days
		.filter((day) => goalsFor(day, nutrient).length > 0)
		.map((day) => weekDayStatus(day, nutrient, today));
	const judged = statuses.filter(
		(status) => status === "ok" || status === "below" || status === "over",
	);
	if (judged.length === 0) return undefined;
	const incomplete = statuses.filter(
		(status) => status === "incomplete",
	).length;
	const over = judged.filter((status) => status === "over").length;
	const ok = judged.filter((status) => status === "ok").length;
	const minimumOnly = days.some((day) => {
		const goals = goalsFor(day, nutrient);
		return goals.length === 1 && goals[0].direction === "min";
	});
	if (over > 0)
		return { kind: "over", count: over, of: judged.length, incomplete };
	return {
		kind: minimumOnly ? "aboveMinimum" : "within",
		count: ok,
		of: judged.length,
		incomplete,
	};
}

/** The goal missed on most days, for the badge beside "All goals". */
export function worstGoal(
	days: readonly WeeklyReviewDay[],
	today: IsoDate,
):
	| { nutrient: NutrientKey; kind: "over" | "below"; count: number }
	| undefined {
	let worst:
		| { nutrient: NutrientKey; kind: "over" | "below"; count: number }
		| undefined;
	const nutrients = new Set(
		days.flatMap((day) =>
			day.goalBasis === "effective"
				? day.goals.map((goal) => goal.nutrient)
				: [],
		),
	);
	for (const kind of ["over", "below"] as const) {
		for (const nutrient of nutrients) {
			const count = days.filter(
				(day) => weekDayStatus(day, nutrient, today) === kind,
			).length;
			if (count > 0 && (!worst || count > worst.count))
				worst = { nutrient, kind, count };
		}
		if (worst) return worst;
	}
	return undefined;
}

function goalsKey(day: WeeklyReviewDay) {
	return day.goalBasis === "effective"
		? JSON.stringify(
				[...day.goals].sort((a, b) =>
					`${a.nutrient}.${a.direction}`.localeCompare(
						`${b.nutrient}.${b.direction}`,
					),
				),
			)
		: "";
}

/** Days inside the week where the applicable goals start or change. */
export function weekGoalChanges(
	days: readonly WeeklyReviewDay[],
): { date: IsoDate; kind: "changed" | "started" }[] {
	const changes: { date: IsoDate; kind: "changed" | "started" }[] = [];
	for (let index = 1; index < days.length; index += 1) {
		const before = goalsKey(days[index - 1]);
		const after = goalsKey(days[index]);
		if (before === after || after === "") continue;
		changes.push({
			date: days[index].date,
			kind: before === "" ? "started" : "changed",
		});
	}
	return changes;
}

export function weekTitleKind(
	weekStart: IsoDate,
	today: IsoDate,
): "current" | "previous" | "numbered" {
	const current = weekStartMonday(today);
	if (weekStart === current) return "current";
	if (weekStart === shiftIsoDate(current, -7)) return "previous";
	return "numbered";
}

/** Five weeks around the chosen one, never past the current week. */
export function weekStripWeeks(weekStart: IsoDate, today: IsoDate): IsoDate[] {
	const current = weekStartMonday(today);
	const plusTwo = shiftIsoDate(weekStart, 14);
	const last = [plusTwo, current].sort()[0] ?? current;
	return Array.from({ length: 5 }, (_, index) =>
		shiftIsoDate(last, (index - 4) * 7),
	);
}
