import { describe, expect, it } from "vitest";
import {
	EQUIPMENT,
	EQUIPMENT_STEPS,
	filterExercises,
	isLoadedEquipment,
	matchesMuscleGroup,
	primaryMuscleGroup,
} from "./exercise";
import { SHIPPED_EXERCISES } from "./exercises";

const exercise = (
	name: string,
	muscleGroups: string[],
	equipment: (typeof EQUIPMENT)[number] = "barbell",
	category: "compound" | "isolation" = "compound",
) => ({ name, muscleGroups, equipment, category });

describe("equipment", () => {
	it("treats only bodyweight and band as unloaded", () => {
		expect(EQUIPMENT.filter((item) => !isLoadedEquipment(item))).toEqual([
			"bodyweight",
			"band",
		]);
	});
	it("has a step for every equipment", () => {
		for (const item of EQUIPMENT)
			expect(EQUIPMENT_STEPS[item]).toBeGreaterThan(0);
	});
});

describe("muscle groups", () => {
	it("matches the aliases the web chips used to miss", () => {
		expect(matchesMuscleGroup(exercise("Crunch", ["Abs"]), "core")).toBe(true);
		expect(matchesMuscleGroup(exercise("Twist", ["obliques"]), "core")).toBe(
			true,
		);
		expect(matchesMuscleGroup(exercise("Curl", ["arms"]), "arms")).toBe(true);
	});
	it("files an exercise under its first known muscle", () => {
		expect(primaryMuscleGroup(exercise("Shrug", ["traps", "forearms"]))).toBe(
			"back",
		);
		expect(primaryMuscleGroup(exercise("Odd", ["neck", "biceps"]))).toBe(
			"arms",
		);
		expect(primaryMuscleGroup(exercise("Neck", ["neck"]))).toBe("other");
	});
	it("leaves only neck work of the shipped catalog ungrouped", () => {
		const ungrouped = new Set(
			SHIPPED_EXERCISES.filter(
				(item) => primaryMuscleGroup(item) === "other",
			).flatMap((item) => item.muscleGroups),
		);
		expect([...ungrouped]).toEqual(["neck"]);
	});
});

describe("filterExercises", () => {
	const catalog = [
		exercise("Squat", ["quadriceps"]),
		exercise("Bench Press", ["chest"]),
		exercise("Band Pull-Apart", ["rear delts"], "band", "isolation"),
		exercise("İnce Row", ["back"]),
	];
	it("trims and lowercases the query and sorts by name", () => {
		expect(
			filterExercises(catalog, { query: "  PRESS " }).map((e) => e.name),
		).toEqual(["Bench Press"]);
		expect(filterExercises(catalog).map((e) => e.name)).toEqual([
			"Band Pull-Apart",
			"Bench Press",
			"İnce Row",
			"Squat",
		]);
	});
	it("combines groups, equipment and category", () => {
		expect(
			filterExercises(catalog, {
				groups: ["shoulders", "legs"],
				equipment: ["band"],
			}).map((e) => e.name),
		).toEqual(["Band Pull-Apart"]);
		expect(
			filterExercises(catalog, { category: "compound", groups: ["chest"] }).map(
				(e) => e.name,
			),
		).toEqual(["Bench Press"]);
	});
});
