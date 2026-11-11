import { describe, expect, it } from "vitest";
import {
	EQUIPMENT,
	filterExercises,
	isLoadedEquipment,
	primaryMuscleGroup,
	validateExerciseInput,
} from "./exercise";
import { SHIPPED_EXERCISES } from "./exercises";

const exercise = (
	name: string,
	muscleGroups: string[],
	equipment: (typeof EQUIPMENT)[number] = "barbell",
	category: "compound" | "isolation" = "compound",
) => ({ name, muscleGroups, equipment, category });

describe("equipment", () => {
	it("treats only bodyweight as unloaded", () => {
		expect(EQUIPMENT.filter((item) => !isLoadedEquipment(item))).toEqual([
			"bodyweight",
		]);
	});
});

describe("muscle groups", () => {
	it("matches the aliases the web chips used to miss", () => {
		const list = [
			exercise("Crunch", ["Abs"]),
			exercise("Twist", ["obliques"]),
			exercise("Curl", ["arms"]),
		];
		expect(
			filterExercises(list, { groups: ["core"] }).map((item) => item.name),
		).toEqual(["Crunch", "Twist"]);
		expect(
			filterExercises(list, { groups: ["arms"] }).map((item) => item.name),
		).toEqual(["Curl"]);
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

describe("validateExerciseInput", () => {
	const input = {
		name: "  Cable Fly ",
		muscleGroups: [" Chest", "chest", "", "Front Delts "],
		category: "isolation" as const,
		equipment: "cable" as const,
		notes: "  ",
		weightIncrement: 2.5,
	};

	it("stores the exercise trimmed, with muscle groups lowercased once each", () => {
		expect(validateExerciseInput(input)).toEqual({
			ok: true,
			value: {
				...input,
				name: "Cable Fly",
				muscleGroups: ["chest", "front delts"],
				notes: undefined,
			},
		});
	});

	it("accepts an exercise without muscle groups", () => {
		expect(validateExerciseInput({ ...input, muscleGroups: [] }).ok).toBe(true);
	});

	it("drops the weight increment for unloaded equipment", () => {
		const result = validateExerciseInput({
			...input,
			equipment: "bodyweight",
			weightIncrement: -1,
		});
		expect(result.ok && result.value.weightIncrement).toBeUndefined();
	});

	it("reports a blank name and a non-positive increment", () => {
		expect(
			validateExerciseInput({ ...input, name: " ", weightIncrement: 0 }),
		).toEqual({
			ok: false,
			errors: [
				{ field: "name", code: "required" },
				{ field: "weightIncrement", code: "invalid" },
			],
		});
	});
});
