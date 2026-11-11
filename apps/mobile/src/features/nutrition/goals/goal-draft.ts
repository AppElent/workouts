import {
	GOAL_DIRECTIONS,
	type GoalDirection,
	type GoalPresetKey,
	NUTRIENT_DEFAULT_DIRECTIONS,
	NUTRIENT_KEYS,
	NUTRITION_GOAL_PRESETS,
	type NutrientKey,
	validateNutritionGoals,
} from "@foundry/core";
import { parseLocalizedDecimal } from "../../../i18n";

export type GoalDraft = Record<NutrientKey, { min: string; max: string }>;

export type GoalRow = {
	nutrient: NutrientKey;
	direction: GoalDirection;
	target: number;
	sourcePreset?: GoalPresetKey;
};

/** Which bounds a goal has: at least, at most, or both. */
export type GoalKind = "min" | "max" | "range";

export type GoalDraftError = {
	key: string;
	message: "invalid" | "range";
};

export function emptyGoalDraft(): GoalDraft {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((nutrient) => [nutrient, { min: "", max: "" }]),
	) as GoalDraft;
}

export function draftFromGoals(goals: readonly GoalRow[]): GoalDraft {
	const draft = emptyGoalDraft();
	for (const goal of goals)
		draft[goal.nutrient][goal.direction] = String(goal.target);
	return draft;
}

export function parseGoalNumber(input: string): number | null {
	if (!input.trim()) return null;
	const value = parseLocalizedDecimal(input);
	return value !== undefined && value > 0 ? value : Number.NaN;
}

/** Every filled bound; unreadable text becomes a NaN target the rules reject. */
export function draftToGoals(draft: GoalDraft): GoalRow[] {
	return NUTRIENT_KEYS.flatMap((nutrient) =>
		GOAL_DIRECTIONS.flatMap((direction) => {
			const target = parseGoalNumber(draft[nutrient][direction]);
			return target === null ? [] : [{ nutrient, direction, target }];
		}),
	);
}

/** The server's goal rules, keyed by `nutrient.direction` or `nutrient.range`. */
export function goalErrors(goals: readonly GoalRow[]): GoalDraftError[] {
	const result = validateNutritionGoals(goals);
	return result.ok
		? []
		: result.errors.map(({ field, code }) => ({
				key: field,
				message: code === "minAboveMax" ? "range" : "invalid",
			}));
}

export function goalKind(bounds: GoalDraft[NutrientKey]): GoalKind | null {
	const min = bounds.min.trim() !== "";
	const max = bounds.max.trim() !== "";
	return min && max ? "range" : min ? "min" : max ? "max" : null;
}

/** Switching kind reuses the number already there, so no value is lost. */
export function setGoalKind(
	draft: GoalDraft,
	nutrient: NutrientKey,
	kind: GoalKind,
): GoalDraft {
	const current = draft[nutrient];
	const keep = current.min || current.max;
	const next =
		kind === "range"
			? { min: current.min || keep, max: current.max || keep }
			: kind === "min"
				? { min: keep, max: "" }
				: { min: "", max: keep };
	return { ...draft, [nutrient]: next };
}

/** The Reference intake target in the nutrient's default direction. */
export function referenceGoalTarget(nutrient: NutrientKey): number {
	const direction = NUTRIENT_DEFAULT_DIRECTIONS[nutrient];
	const goal = NUTRITION_GOAL_PRESETS.reference.goals.find(
		(item) => item.nutrient === nutrient && item.direction === direction,
	);
	if (!goal) throw new Error(`No reference goal for ${nutrient}.`);
	return goal.target;
}

export function withGoal(draft: GoalDraft, nutrient: NutrientKey): GoalDraft {
	const direction = NUTRIENT_DEFAULT_DIRECTIONS[nutrient];
	return {
		...draft,
		[nutrient]: {
			min: "",
			max: "",
			[direction]: String(referenceGoalTarget(nutrient)),
		},
	};
}

export function withoutGoal(
	draft: GoalDraft,
	nutrient: NutrientKey,
): GoalDraft {
	return { ...draft, [nutrient]: { min: "", max: "" } };
}

export function goalDraftEquals(left: GoalDraft, right: GoalDraft): boolean {
	return NUTRIENT_KEYS.every(
		(nutrient) =>
			left[nutrient].min === right[nutrient].min &&
			left[nutrient].max === right[nutrient].max,
	);
}
