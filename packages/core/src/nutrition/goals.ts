import type { NutrientKey } from "./nutrients";

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
