import {
	isRealIsoDate,
	type NutritionGoal,
	type NutritionGoalCode,
	validateNutritionGoals,
} from "@foundry/core";

/** Calendar-date validation for mutation and query arguments. */
export function assertCalendarDate(date: string): void {
	if (!isRealIsoDate(date)) throw new Error("Invalid effective date.");
}

/** The server fallback for legacy calls that omit `effectiveFrom`. */
export function utcTodayIsoDate(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}

const GOAL_ERRORS: Record<NutritionGoalCode, string> = {
	tooMany: "A maximum of 16 goal bounds is allowed.",
	notPositive: "Goal must be greater than zero.",
	tooLarge: "Goal must be greater than zero and at most 100000.",
	duplicate: "Goals contain a duplicate nutrient bound.",
	minAboveMax: "A minimum goal cannot be greater than its maximum.",
};

/** The core goal rules, thrown as the server's error text. */
export function assertNutritionGoals(goals: readonly NutritionGoal[]): void {
	const result = validateNutritionGoals(goals);
	if (!result.ok) throw new Error(GOAL_ERRORS[result.errors[0].code]);
}
