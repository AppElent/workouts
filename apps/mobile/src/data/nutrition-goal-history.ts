import {
	GOAL_DIRECTIONS,
	type GoalDirection,
	NUTRIENT_KEYS,
	type NutrientKey,
} from "@workouts/core/nutrition";

export type GoalDraft = Record<NutrientKey, { min: string; max: string }>;

export type GoalRow = {
	nutrient: NutrientKey;
	direction: GoalDirection;
	target: number;
	sourcePreset?: "reference" | "loseWeight" | "buildMuscle";
};

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
	const normalized = input.trim().replace(",", ".");
	if (!normalized) return null;
	const value = Number(normalized);
	return Number.isFinite(value) && value > 0 ? value : Number.NaN;
}

export function enabledGoalNutrients(draft: GoalDraft): NutrientKey[] {
	return NUTRIENT_KEYS.filter(
		(nutrient) =>
			nutrient === "energy" ||
			draft[nutrient].min.trim().length > 0 ||
			draft[nutrient].max.trim().length > 0,
	);
}

export function draftToGoals(draft: GoalDraft): {
	goals: GoalRow[];
	errors: GoalDraftError[];
} {
	const goals: GoalRow[] = [];
	const errors: GoalDraftError[] = [];
	for (const nutrient of NUTRIENT_KEYS) {
		const values = draft[nutrient];
		const parsed = {
			min: parseGoalNumber(values.min),
			max: parseGoalNumber(values.max),
		};
		for (const direction of GOAL_DIRECTIONS) {
			if (Number.isNaN(parsed[direction])) {
				errors.push({ key: `${nutrient}.${direction}`, message: "invalid" });
			}
		}
		if (
			parsed.min !== null &&
			parsed.max !== null &&
			!Number.isNaN(parsed.min) &&
			!Number.isNaN(parsed.max) &&
			parsed.min > parsed.max
		) {
			errors.push({ key: `${nutrient}.range`, message: "range" });
		}
		for (const direction of GOAL_DIRECTIONS) {
			const target = parsed[direction];
			if (target !== null && !Number.isNaN(target)) {
				goals.push({ nutrient, direction, target });
			}
		}
	}
	return { goals, errors };
}

export function goalDraftEquals(left: GoalDraft, right: GoalDraft): boolean {
	return NUTRIENT_KEYS.every(
		(nutrient) =>
			left[nutrient].min === right[nutrient].min &&
			left[nutrient].max === right[nutrient].max,
	);
}

export function goalHistoryLabel({
	basis,
	effectiveFrom,
	locale,
}: {
	basis: "effective" | "reference";
	effectiveFrom: string | null;
	locale: string;
}): string {
	if (basis === "reference")
		return locale === "nl" ? "Referentie (oud)" : "Reference (legacy)";
	return locale === "nl"
		? `Geldig vanaf ${effectiveFrom}`
		: `Applies from ${effectiveFrom}`;
}
