import { describe, expect, it } from "vitest";
import {
	countStep,
	EQUIPMENT,
	exerciseMeasure,
	filterExercises,
	isLoadedEquipment,
	isLoadedExercise,
	isTimedExercise,
	MUSCLE_GROUPS,
	muscleKey,
	primaryMuscleGroup,
	TIMED_DEFAULT_SECONDS,
	TIMED_LONG_HOLD_SECONDS,
	TIMED_STEP_SECONDS,
	timedLookup,
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

describe("muscle vocabulary", () => {
	it("names every muscle the shipped catalog uses", () => {
		const unknown = SHIPPED_EXERCISES.flatMap(
			(item) => item.muscleGroups,
		).filter((name) => name.trim() && !muscleKey(name));
		expect(unknown).toEqual([]);
	});
	it("names every muscle a muscle group filters on", () => {
		const unknown = Object.values(MUSCLE_GROUPS)
			.flat()
			.filter((name) => !muscleKey(name));
		expect(unknown).toEqual([]);
	});
	it("folds aliases, case and stray spaces onto one key", () => {
		expect(muscleKey(" Front Delts ")).toBe("frontDelts");
		expect(muscleKey("Quads")).toBe("quadriceps");
		expect(muscleKey("Abdominals")).toBe("abs");
		expect(muscleKey("pinkies")).toBeUndefined();
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

describe("timed holds", () => {
	it("starts a hold on a round number the step lands on", () => {
		expect(TIMED_DEFAULT_SECONDS).toBe(30);
		expect(TIMED_DEFAULT_SECONDS % TIMED_STEP_SECONDS).toBe(0);
		expect(TIMED_LONG_HOLD_SECONDS).toBe(600);
	});

	it("steps seconds in fives and reps one at a time", () => {
		expect(countStep(true)).toBe(5);
		expect(countStep(false)).toBe(1);
	});

	it("reads a Personal Exercise's measure, and reps when it has none", () => {
		expect(isTimedExercise({ _id: "mine", measure: "seconds" })).toBe(true);
		expect(isTimedExercise({ _id: "mine", measure: "reps" })).toBe(false);
		expect(isTimedExercise({ _id: "mine" })).toBe(false);
		expect(isTimedExercise(null)).toBe(false);
		expect(exerciseMeasure({ _id: "shipped:exercise:plank" })).toBe("seconds");
	});

	it("looks holds up by id, shipped ones before the catalog loads", () => {
		const isTimed = timedLookup([
			{ _id: "hold", measure: "seconds" },
			{ _id: "lift" },
		]);
		expect(["hold", "lift", "shipped:exercise:plank"].map(isTimed)).toEqual([
			true,
			false,
			true,
		]);
		expect(timedLookup([])("shipped:exercise:plank")).toBe(true);
	});

	it("treats a hold's load as added weight on any equipment", () => {
		expect(isLoadedExercise({ equipment: "barbell" })).toBe(true);
		expect(isLoadedExercise({ equipment: "barbell", measure: "seconds" })).toBe(
			false,
		);
	});

	it("keeps an omitted measure omitted, so an older app never clears it", () => {
		const result = validateExerciseInput({
			name: "Side plank",
			muscleGroups: ["core"],
			category: "isolation",
			equipment: "bodyweight",
		});
		expect(result.ok && "measure" in result.value).toBe(false);
	});
});
