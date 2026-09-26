import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	CURATED_EXERCISES,
	DEFAULT_EXERCISES,
	getShippedExercise,
	mergeExerciseCatalog,
	WRKOUT_EXERCISES,
} from "./index";

describe("shipped exercise catalog", () => {
	it("keeps all permanent IDs and has unique names and usable instructions", () => {
		const ids = JSON.parse(
			readFileSync(new URL("./ids.json", import.meta.url), "utf8"),
		);
		expect(CURATED_EXERCISES).toHaveLength(54);
		expect(DEFAULT_EXERCISES).toHaveLength(672);
		expect(
			new Set(DEFAULT_EXERCISES.map((exercise) => exercise._id)).size,
		).toBe(672);
		expect(
			new Set(
				DEFAULT_EXERCISES.map((exercise) =>
					exercise.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
				),
			).size,
		).toBe(672);
		for (const exercise of DEFAULT_EXERCISES) {
			expect(exercise._id).toBe(ids[exercise.name]);
			expect(exercise.instructions.length).toBeGreaterThan(0);
			expect(exercise.muscleGroups.length).toBeGreaterThan(0);
			expect(getShippedExercise(exercise._id)?.name).toBe(exercise.name);
		}
		for (const exercise of WRKOUT_EXERCISES) {
			expect(
				exercise.muscleGroups.some((muscle) =>
					["abdominals", "lats", "middle back"].includes(muscle),
				),
			).toBe(false);
		}
	});
	it("preserves shipped IDs and same-name personal exercises", () => {
		const shipped = getShippedExercise(DEFAULT_EXERCISES[0]._id);
		if (!shipped) throw new Error("Missing shipped exercise");
		const merged = mergeExerciseCatalog([
			{ ...shipped, _id: "personal-id", isDefault: false },
		]);
		expect(merged).toHaveLength(673);
		expect(
			merged
				.filter((exercise) => exercise.name === shipped.name)
				.map((exercise) => exercise._id)
				.sort(),
		).toEqual([shipped._id, "personal-id"].sort());
	});
});
