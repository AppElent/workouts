import {
	type Equipment,
	type ExerciseCategory,
	filterExercises as filterCatalog,
	type MuscleGroup,
} from "@foundry/core";
import type { Exercise } from "@foundry/core/exercises";

export type Layout = "list" | "groups";
export type Filters = {
	groups: MuscleGroup[];
	equipment: Equipment[];
	category: "all" | ExerciseCategory;
};
export const emptyFilters = (): Filters => ({
	groups: [],
	equipment: [],
	category: "all",
});

/** The library's search, scope and filter sheet applied to the catalog. */
export function filterExercises(
	exercises: readonly Exercise[],
	search: string,
	personal: boolean,
	filters: Filters,
) {
	return filterCatalog(
		personal ? exercises.filter((exercise) => !exercise.isDefault) : exercises,
		{
			query: search,
			groups: filters.groups,
			equipment: filters.equipment,
			category: filters.category === "all" ? undefined : filters.category,
		},
	);
}

export function toggleChoice<T>(values: T[], value: T): T[] {
	return values.includes(value)
		? values.filter((v) => v !== value)
		: [...values, value];
}
