import { type IsoDate, isRealIsoDate } from "../calendar";
import { RuleError, type RuleResult, ruleIssues } from "../rules";
import type { NutrientTotal } from "./aggregate";
import { NUTRIENT_KEYS, type NutrientKey } from "./nutrients";

export const GOAL_DIRECTIONS = ["min", "max"] as const;
export type GoalDirection = (typeof GOAL_DIRECTIONS)[number];
export const GOAL_PRESET_KEYS = [
	"reference",
	"loseWeight",
	"buildMuscle",
] as const;
export type GoalPresetKey = (typeof GOAL_PRESET_KEYS)[number];

export type NutritionGoalValue = {
	nutrient: NutrientKey;
	direction: GoalDirection;
	target: number;
};

export const NUTRIENT_DEFAULT_DIRECTIONS: Readonly<
	Record<NutrientKey, GoalDirection>
> = {
	energy: "max",
	protein: "min",
	carbs: "max",
	fat: "max",
	saturatedFat: "max",
	fibre: "min",
	sugars: "max",
	salt: "max",
};

const referenceGoals: NutritionGoalValue[] = [
	{ nutrient: "energy", direction: "max", target: 2000 },
	{ nutrient: "protein", direction: "min", target: 50 },
	{ nutrient: "carbs", direction: "max", target: 260 },
	{ nutrient: "fat", direction: "max", target: 70 },
	{ nutrient: "saturatedFat", direction: "max", target: 20 },
	{ nutrient: "fibre", direction: "min", target: 25 },
	{ nutrient: "sugars", direction: "max", target: 90 },
	{ nutrient: "salt", direction: "max", target: 6 },
];

export const NUTRITION_GOAL_PRESETS = {
	reference: {
		goals: referenceGoals,
		provenance: "EU Regulation 1169/2011 Annex XIII; EFSA fibre guidance",
		delta: undefined,
	},
	loseWeight: {
		goals: referenceGoals.map((goal) =>
			goal.nutrient === "energy" ? { ...goal, target: 1700 } : { ...goal },
		),
		provenance: "Fixed variant of Reference intake; not personalised advice",
		delta: "Energy −300 kcal",
	},
	buildMuscle: {
		goals: referenceGoals.map((goal) =>
			goal.nutrient === "energy"
				? { ...goal, target: 2300 }
				: goal.nutrient === "protein"
					? { ...goal, target: 100 }
					: { ...goal },
		),
		provenance: "Fixed variant of Reference intake; not personalised advice",
		delta: "Energy +300 kcal; protein +50 g",
	},
} as const;

export function editedGoalCount(
	preset: GoalPresetKey,
	goals: readonly (Pick<NutritionGoalValue, "nutrient" | "direction"> & {
		sourcePreset?: GoalPresetKey;
	})[],
): number {
	return NUTRITION_GOAL_PRESETS[preset].goals.filter((expected) => {
		const goal = goals.find(
			(row) =>
				row.nutrient === expected.nutrient &&
				row.direction === expected.direction,
		);
		return goal?.sourcePreset !== preset;
	}).length;
}

/** A stored goal bound: one direction for one nutrient. */
export type NutritionGoal = NutritionGoalValue & {
	sourcePreset?: GoalPresetKey;
};

export const NUTRITION_GOAL_LIMITS = Object.freeze({
	/** One min and one max for each of the eight nutrients. */
	maxBounds: 16,
	maxTarget: 100_000,
});

/** `${nutrient}.${direction}` for one bound, `${nutrient}.range` for a min/max pair. */
export type NutritionGoalField =
	| "goals"
	| `${NutrientKey}.${GoalDirection}`
	| `${NutrientKey}.range`;
export type NutritionGoalCode =
	| "tooMany"
	| "notPositive"
	| "tooLarge"
	| "duplicate"
	| "minAboveMax";

/** A goal set as the server stores it: positive capped targets, one bound per direction, min ≤ max. */
export function validateNutritionGoals<G extends NutritionGoalValue>(
	goals: readonly G[],
): RuleResult<readonly G[], NutritionGoalField, NutritionGoalCode> {
	const issues = ruleIssues<NutritionGoalField, NutritionGoalCode>();
	if (goals.length > NUTRITION_GOAL_LIMITS.maxBounds)
		issues.add("goals", "tooMany");
	const seen = new Set<string>();
	const minimums = new Map<NutrientKey, number>();
	const maximums = new Map<NutrientKey, number>();
	for (const goal of goals) {
		const field = `${goal.nutrient}.${goal.direction}` as const;
		if (!Number.isFinite(goal.target) || goal.target <= 0)
			issues.add(field, "notPositive");
		else if (goal.target > NUTRITION_GOAL_LIMITS.maxTarget)
			issues.add(field, "tooLarge");
		if (seen.has(field)) issues.add(field, "duplicate");
		seen.add(field);
		(goal.direction === "min" ? minimums : maximums).set(
			goal.nutrient,
			goal.target,
		);
	}
	for (const nutrient of NUTRIENT_KEYS) {
		const minimum = minimums.get(nutrient);
		const maximum = maximums.get(nutrient);
		if (minimum !== undefined && maximum !== undefined && minimum > maximum)
			issues.add(`${nutrient}.range`, "minAboveMax");
	}
	return issues.result(goals);
}

export type EffectiveGoalVersion = {
	effectiveFrom: IsoDate;
	goals: NutritionGoal[];
	referenceGoals?: NutritionGoal[];
};

export type GoalHistoryBasis = "effective" | "reference";

export type ResolvedGoalHistory = {
	goals: NutritionGoal[];
	basis: GoalHistoryBasis;
	effectiveFrom: IsoDate | null;
};

/**
 * The goals in force on `date`, without manufacturing a historical target.
 * Before the first effective version, legacy goals come back as a labelled
 * reference only; with no legacy goals, an honest empty reference.
 * Throws `RuleError` (`date` or `effectiveFrom`, code `invalid`).
 */
export function resolveGoalHistory({
	date,
	legacyGoals,
	versions,
	referenceGoals,
}: {
	date: IsoDate;
	legacyGoals: readonly NutritionGoal[];
	versions: readonly EffectiveGoalVersion[];
	referenceGoals?: readonly NutritionGoal[];
}): ResolvedGoalHistory {
	if (!isRealIsoDate(date)) throw new RuleError("date", "invalid");
	let selected: EffectiveGoalVersion | undefined;
	for (const version of versions) {
		if (!isRealIsoDate(version.effectiveFrom))
			throw new RuleError("effectiveFrom", "invalid");
		if (
			version.effectiveFrom <= date &&
			(selected === undefined || version.effectiveFrom > selected.effectiveFrom)
		)
			selected = version;
	}
	if (selected)
		return {
			goals: [...selected.goals],
			basis: "effective",
			effectiveFrom: selected.effectiveFrom,
		};
	return {
		goals: [...(referenceGoals ?? legacyGoals)],
		basis: "reference",
		effectiveFrom: null,
	};
}

/** A nutrient's goal bounds together, as every goal label and status reads them. */
export type GoalBounds = {
	readonly nutrient: NutrientKey;
	readonly min?: number;
	readonly max?: number;
};

/** One `GoalBounds` per nutrient that has a goal, in `order`. */
export function goalBounds(
	goals: readonly NutritionGoalValue[],
	order: readonly NutrientKey[] = NUTRIENT_KEYS,
): GoalBounds[] {
	return order.flatMap((nutrient) => {
		const min = goals.find(
			(goal) => goal.nutrient === nutrient && goal.direction === "min",
		)?.target;
		const max = goals.find(
			(goal) => goal.nutrient === nutrient && goal.direction === "max",
		)?.target;
		if (min === undefined && max === undefined) return [];
		return [
			{
				nutrient,
				...(min === undefined ? {} : { min }),
				...(max === undefined ? {} : { max }),
			},
		];
	});
}

/**
 * - `noGoal`: neither bound is set.
 * - `empty`: nothing logged yet; zero is neutral, never failure.
 * - `incomplete`: a figure is missing, so the total is only a lower bound.
 *   Over a maximum it is still `exceeded`, because more can only add.
 * - `below` a minimum, `met` a minimum-only goal, `within` the bounds,
 *   `exceeded` a maximum.
 */
export type GoalStatus =
	| "noGoal"
	| "empty"
	| "incomplete"
	| "below"
	| "met"
	| "within"
	| "exceeded";

export type GoalEvaluation = {
	readonly status: GoalStatus;
	/** The total has a trace or estimated figure in it. */
	readonly approximate: boolean;
	/** How far under the minimum (`below`). */
	readonly toMinimum?: number;
	/** How much is left before the maximum (`within` with a maximum; 0 at it). */
	readonly toMaximum?: number;
	/** How far over the maximum (`exceeded`). */
	readonly over?: number;
};

export function evaluateGoal(
	bounds: Pick<GoalBounds, "min" | "max">,
	total: NutrientTotal | undefined,
): GoalEvaluation {
	const { min, max } = bounds;
	if (min === undefined && max === undefined)
		return { status: "noGoal", approximate: false };
	if (!total || total.entryCount === 0)
		return { status: "empty", approximate: false };
	const { amount } = total;
	const approximate = total.qualified;
	if (max !== undefined && amount > max)
		return { status: "exceeded", approximate, over: amount - max };
	if (total.incomplete) return { status: "incomplete", approximate };
	if (min !== undefined && amount < min)
		return { status: "below", approximate, toMinimum: min - amount };
	if (max !== undefined)
		return { status: "within", approximate, toMaximum: max - amount };
	return { status: "met", approximate };
}
