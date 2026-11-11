import { type RuleResult, ruleIssues } from "./rules";

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

/**
 * What logging a set on each piece of equipment means. `loaded`: the load is
 * entered as a weight, so the set can feed One-rep Max references and the
 * exercise has a weight increment; bodyweight alone is not. `step`: the
 * default weight increment, in the set's unit.
 */
const EQUIPMENT_TRAITS: Readonly<
	Record<Equipment, { readonly loaded: boolean; readonly step: number }>
> = {
	barbell: { loaded: true, step: 2.5 },
	dumbbell: { loaded: true, step: 1 },
	cable: { loaded: true, step: 5 },
	machine: { loaded: true, step: 5 },
	kettlebell: { loaded: true, step: 4 },
	band: { loaded: true, step: 2.5 },
	bodyweight: { loaded: false, step: 2.5 },
	other: { loaded: true, step: 2.5 },
};

export function isLoadedEquipment(equipment: Equipment): boolean {
	return EQUIPMENT_TRAITS[equipment].loaded;
}

export const EXERCISE_CATEGORIES = ["compound", "isolation"] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export function getWeightStep(equipment: Equipment, increment?: number) {
	return increment !== undefined && Number.isFinite(increment) && increment > 0
		? increment
		: EQUIPMENT_TRAITS[equipment].step;
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

export type ExerciseInput = {
	readonly name: string;
	readonly muscleGroups: readonly string[];
	readonly category: ExerciseCategory;
	readonly equipment: Equipment;
	readonly notes?: string;
	readonly weightIncrement?: number;
};

type Normalized<T extends ExerciseInput> = Omit<
	T,
	"name" | "muscleGroups" | "notes" | "weightIncrement"
> & {
	name: string;
	muscleGroups: string[];
	notes: string | undefined;
	weightIncrement: number | undefined;
};

/**
 * A personal exercise as it is stored: trimmed name and notes, muscle groups
 * trimmed, lowercased and without duplicates (none is fine), and a weight
 * increment only for loaded equipment.
 */
export function validateExerciseInput<T extends ExerciseInput>(
	input: T,
): RuleResult<
	Normalized<T>,
	"name" | "weightIncrement",
	"required" | "invalid"
> {
	const found = ruleIssues<
		"name" | "weightIncrement",
		"required" | "invalid"
	>();
	const name = input.name.trim();
	if (!name) found.add("name", "required");
	const weightIncrement = isLoadedEquipment(input.equipment)
		? input.weightIncrement
		: undefined;
	if (
		weightIncrement !== undefined &&
		(!Number.isFinite(weightIncrement) || weightIncrement <= 0)
	)
		found.add("weightIncrement", "invalid");
	const muscleGroups = [
		...new Set(
			input.muscleGroups
				.map((muscle) => muscle.trim().toLowerCase())
				.filter(Boolean),
		),
	];
	return found.result({
		...input,
		name,
		muscleGroups,
		notes: input.notes?.trim() || undefined,
		weightIncrement,
	});
}
