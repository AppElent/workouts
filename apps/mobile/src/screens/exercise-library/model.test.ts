import type { Exercise } from "@workouts/core/exercises";
import { emptyFilters, filterExercises, primaryGroup } from "./model";

const catalog: Exercise[] = [
	{
		_id: "bench",
		_creationTime: 0,
		isDefault: true,
		name: "Bench press",
		muscleGroups: ["chest", "triceps"],
		category: "compound",
		equipment: "barbell",
	},
	{
		_id: "fly",
		_creationTime: 0,
		isDefault: false,
		name: "Cable fly",
		muscleGroups: ["chest"],
		category: "isolation",
		equipment: "cable",
	},
	{
		_id: "row",
		_creationTime: 0,
		isDefault: true,
		name: "Dumbbell row",
		muscleGroups: ["lats", "biceps"],
		category: "compound",
		equipment: "dumbbell",
	},
	{
		_id: "squat",
		_creationTime: 0,
		isDefault: true,
		name: "Squat",
		muscleGroups: ["quadriceps", "glutes"],
		category: "compound",
		equipment: "barbell",
	},
];
it("unions each multi-select category and intersects the categories", () => {
	expect(
		filterExercises(catalog, "", false, {
			groups: ["chest", "back"],
			equipment: ["barbell", "dumbbell"],
			category: "compound",
		}).map((e) => e._id),
	).toEqual(["bench", "row"]);
});
it("combines personal scope and trimmed case-insensitive search", () => {
	expect(
		filterExercises(catalog, " FLY ", true, emptyFilters()).map((e) => e._id),
	).toEqual(["fly"]);
	expect(filterExercises(catalog, "bench", true, emptyFilters())).toEqual([]);
});
it("matches secondary muscles but groups an exercise under its primary muscle once", () => {
	expect(
		filterExercises(catalog, "", false, {
			...emptyFilters(),
			groups: ["arms"],
		}).map((e) => e._id),
	).toEqual(["bench", "row"]);
	expect(catalog.map(primaryGroup)).toEqual(["chest", "chest", "back", "legs"]);
	expect(primaryGroup({ ...catalog[0], muscleGroups: ["unknown"] })).toBe(
		"other",
	);
});
it("never mutates catalog order or staged filters while calculating results", () => {
	const filters = { ...emptyFilters(), groups: ["chest" as const] };
	const before = JSON.stringify({ catalog, filters });
	filterExercises(catalog, "", false, filters);
	expect(JSON.stringify({ catalog, filters })).toBe(before);
});
