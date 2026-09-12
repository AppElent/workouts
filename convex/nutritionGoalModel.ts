export const NUTRITION_GOAL_NUTRIENTS = [
	"energy",
	"protein",
	"carbs",
	"fat",
	"saturatedFat",
	"fibre",
	"sugars",
	"salt",
] as const;

export type NutritionGoalNutrient =
	(typeof NUTRITION_GOAL_NUTRIENTS)[number];
export type NutritionGoalDirection = "min" | "max";
export type NutritionGoalPreset = "reference" | "loseWeight" | "buildMuscle";

export type NutritionGoal = {
	nutrient: NutritionGoalNutrient;
	direction: NutritionGoalDirection;
	target: number;
	sourcePreset?: NutritionGoalPreset;
};

export type EffectiveGoalVersion = {
	effectiveFrom: string;
	goals: NutritionGoal[];
	referenceGoals?: NutritionGoal[];
};

export type GoalHistoryBasis = "effective" | "reference";

export type ResolvedGoalHistory = {
	goals: NutritionGoal[];
	basis: GoalHistoryBasis;
	effectiveFrom: string | null;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar-date validation shared by mutations and pure history tests. */
export function assertCalendarDate(date: string): void {
	const match = ISO_DATE.exec(date);
	if (!match) throw new Error("Invalid effective date.");
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const candidate = new Date(Date.UTC(year, month - 1, day));
	if (
		candidate.getUTCFullYear() !== year ||
		candidate.getUTCMonth() !== month - 1 ||
		candidate.getUTCDate() !== day
	) {
		throw new Error("Invalid effective date.");
	}
}

/** The server fallback for legacy calls that omit `effectiveFrom`. */
export function utcTodayIsoDate(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}

export function validateNutritionGoals(goals: readonly NutritionGoal[]): void {
	if (goals.length > 16) {
		throw new Error("A maximum of 16 goal bounds is allowed.");
	}
	const seen = new Set<string>();
	const minimums = new Map<NutritionGoalNutrient, number>();
	const maximums = new Map<NutritionGoalNutrient, number>();

	for (const goal of goals) {
		if (
			!Number.isFinite(goal.target) ||
			goal.target <= 0 ||
			goal.target > 100000
		) {
			throw new Error("Goal must be greater than zero.");
		}
		const key = `${goal.nutrient}:${goal.direction}`;
		if (seen.has(key)) {
			throw new Error("Goals contain a duplicate nutrient bound.");
		}
		seen.add(key);
		if (goal.direction === "min") minimums.set(goal.nutrient, goal.target);
		else maximums.set(goal.nutrient, goal.target);
	}

	for (const nutrient of NUTRITION_GOAL_NUTRIENTS) {
		const minimum = minimums.get(nutrient);
		const maximum = maximums.get(nutrient);
		if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
			throw new Error("A minimum goal cannot be greater than its maximum.");
		}
	}
}

/**
 * Resolve a day without manufacturing a historical target. Before the first
 * effective version, legacy goals are returned as a labeled reference only;
 * if there are no legacy goals, the result is an honest empty reference.
 */
export function resolveGoalHistory({
	date,
	legacyGoals,
	versions,
	referenceGoals,
}: {
	date: string;
	legacyGoals: readonly NutritionGoal[];
	versions: readonly EffectiveGoalVersion[];
	referenceGoals?: readonly NutritionGoal[];
}): ResolvedGoalHistory {
	assertCalendarDate(date);
	let selected: EffectiveGoalVersion | undefined;
	for (const version of versions) {
		assertCalendarDate(version.effectiveFrom);
		if (version.effectiveFrom <= date) {
			if (
				selected === undefined ||
				version.effectiveFrom > selected.effectiveFrom
			) {
				selected = version;
			}
		}
	}
	if (selected) {
		return {
			goals: [...selected.goals],
			basis: "effective",
			effectiveFrom: selected.effectiveFrom,
		};
	}
	return {
		goals: [...(referenceGoals ?? legacyGoals)],
		basis: "reference",
		effectiveFrom: null,
	};
}
