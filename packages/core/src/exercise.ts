export const EQUIPMENT = [
	"barbell",
	"dumbbell",
	"cable",
	"bodyweight",
	"machine",
	"kettlebell",
	"band",
	"other",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/** Equipment whose load is entered as a weight, so it has a weight increment. */
const LOADED_EQUIPMENT = [
	"barbell",
	"dumbbell",
	"cable",
	"machine",
	"kettlebell",
	"other",
] as const satisfies readonly Equipment[];
type LoadedEquipment = (typeof LOADED_EQUIPMENT)[number];

export function isLoadedEquipment(
	equipment: Equipment,
): equipment is LoadedEquipment {
	return (LOADED_EQUIPMENT as readonly Equipment[]).includes(equipment);
}

export const EXERCISE_CATEGORIES = ["compound", "isolation"] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

/** Default weight increment per equipment, in the set's unit. */
const EQUIPMENT_STEPS: Readonly<Record<Equipment, number>> = {
	barbell: 2.5,
	dumbbell: 1,
	cable: 5,
	machine: 5,
	kettlebell: 4,
	band: 2.5,
	bodyweight: 2.5,
	other: 2.5,
};

export function getWeightStep(equipment: Equipment, increment?: number) {
	return increment !== undefined && Number.isFinite(increment) && increment > 0
		? increment
		: EQUIPMENT_STEPS[equipment];
}

/**
 * Muscle-group filters and the catalog muscle names each one covers. The
 * catalog spells muscles inconsistently (imported and curated data), so a
 * filter matches every alias.
 */
export const MUSCLE_GROUPS = {
	chest: ["chest"],
	back: ["back", "lats", "lower back", "traps"],
	legs: [
		"quads",
		"quadriceps",
		"hamstrings",
		"glutes",
		"calves",
		"adductors",
		"abductors",
	],
	shoulders: ["shoulders", "front delts", "side delts", "rear delts", "traps"],
	arms: ["arms", "biceps", "triceps", "forearms"],
	core: ["core", "abs", "abdominals", "obliques"],
} as const satisfies Record<string, readonly string[]>;
export type MuscleGroup = keyof typeof MUSCLE_GROUPS;
export const MUSCLE_GROUP_KEYS = Object.keys(MUSCLE_GROUPS) as MuscleGroup[];

type Muscled = { readonly muscleGroups: readonly string[] };

function inGroup(muscle: string, group: MuscleGroup) {
	return (MUSCLE_GROUPS[group] as readonly string[]).includes(
		muscle.trim().toLocaleLowerCase(),
	);
}

function matchesMuscleGroup(exercise: Muscled, group: MuscleGroup) {
	return exercise.muscleGroups.some((muscle) => inGroup(muscle, group));
}

/** The group of the first (primary) muscle the taxonomy knows, else "other". */
export function primaryMuscleGroup(exercise: Muscled): MuscleGroup | "other" {
	for (const muscle of exercise.muscleGroups) {
		const group = MUSCLE_GROUP_KEYS.find((key) => inGroup(muscle, key));
		if (group) return group;
	}
	return "other";
}

type ExerciseFilter = {
	/** Case-insensitive substring of the name; blank matches everything. */
	readonly query?: string;
	/** Matches when the exercise is in any of these groups; empty matches all. */
	readonly groups?: readonly MuscleGroup[];
	/** Matches any of these; empty matches all. */
	readonly equipment?: readonly Equipment[];
	readonly category?: ExerciseCategory;
};

/** Filters the catalog and sorts the result by name. */
export function filterExercises<
	T extends Muscled & {
		readonly name: string;
		readonly equipment: Equipment;
		readonly category: ExerciseCategory;
	},
>(exercises: readonly T[], filter: ExerciseFilter = {}): T[] {
	const term = (filter.query ?? "").trim().toLocaleLowerCase();
	const groups = filter.groups ?? [];
	const equipment = filter.equipment ?? [];
	return exercises
		.filter(
			(exercise) =>
				(!term || exercise.name.toLocaleLowerCase().includes(term)) &&
				(!groups.length ||
					groups.some((group) => matchesMuscleGroup(exercise, group))) &&
				(!equipment.length || equipment.includes(exercise.equipment)) &&
				(!filter.category || exercise.category === filter.category),
		)
		.sort((a, b) => a.name.localeCompare(b.name));
}
