import type { Exercise } from "@workouts/core/exercises";

export const GROUPS = {
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
} as const;
export type Group = keyof typeof GROUPS;
export const GROUP_KEYS = Object.keys(GROUPS) as Group[];
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
export type Layout = "list" | "groups";
export type Filters = {
	groups: Group[];
	equipment: Equipment[];
	category: "all" | "compound" | "isolation";
};
export const emptyFilters = (): Filters => ({
	groups: [],
	equipment: [],
	category: "all",
});
export function matchesGroup(exercise: Exercise, group: Group) {
	const aliases: readonly string[] = GROUPS[group];
	return exercise.muscleGroups.some((m) => aliases.includes(m.toLowerCase()));
}
export function primaryGroup(exercise: Exercise): Group | "other" {
	// Assign each exercise once, using the catalog's first (primary) muscle.
	for (const muscle of exercise.muscleGroups) {
		const group = GROUP_KEYS.find((key) =>
			(GROUPS[key] as readonly string[]).includes(muscle.toLowerCase()),
		);
		if (group) return group;
	}
	return "other";
}
export function filterExercises(
	exercises: readonly Exercise[],
	search: string,
	personal: boolean,
	filters: Filters,
) {
	const term = search.trim().toLocaleLowerCase();
	return exercises
		.filter(
			(ex) =>
				(!term || ex.name.toLocaleLowerCase().includes(term)) &&
				(!personal || !ex.isDefault) &&
				(!filters.groups.length ||
					filters.groups.some((g) => matchesGroup(ex, g))) &&
				(!filters.equipment.length ||
					filters.equipment.includes(ex.equipment)) &&
				(filters.category === "all" || ex.category === filters.category),
		)
		.sort((a, b) => a.name.localeCompare(b.name));
}
export function toggleChoice<T>(values: T[], value: T): T[] {
	return values.includes(value)
		? values.filter((v) => v !== value)
		: [...values, value];
}
