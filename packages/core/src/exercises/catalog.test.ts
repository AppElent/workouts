import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	isLoadedEquipment,
	isTimedExercise,
	TIMED_EXERCISES,
} from "../exercise";
import { DEFAULT_EXERCISES } from "./exercises";
import { getShippedExercise, mergeExerciseCatalog } from "./index";
import { WRKOUT_EXERCISES } from "./wrkoutExercises";

describe("shipped exercise catalog", () => {
	it("keeps all permanent IDs and has unique names and usable instructions", () => {
		const ids = JSON.parse(
			readFileSync(new URL("./ids.json", import.meta.url), "utf8"),
		);
		expect(
			new Set(DEFAULT_EXERCISES.map((exercise) => exercise._id)).size,
		).toBe(DEFAULT_EXERCISES.length);
		expect(
			new Set(
				DEFAULT_EXERCISES.map((exercise) =>
					exercise.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
				),
			).size,
		).toBe(DEFAULT_EXERCISES.length);
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
	it("logs bodyweight movements reps-only, without a required load (APP-217)", () => {
		for (const id of [
			"shipped:exercise:push-up",
			"shipped:exercise:chin-up",
			"shipped:exercise:pull-up",
			"shipped:exercise:inverted-row",
			"shipped:exercise:decline-push-up",
			"shipped:exercise:suspended-row",
			"shipped:exercise:ring-dips",
		]) {
			const exercise = getShippedExercise(id);
			expect(exercise?.equipment, id).toBe("bodyweight");
			expect(isLoadedEquipment(exercise?.equipment ?? "other"), id).toBe(false);
		}
		// Weighted variants still take a load.
		expect(
			getShippedExercise("shipped:exercise:weighted-pull-ups")?.equipment,
		).toBe("other");
	});
	it("preserves shipped IDs and same-name personal exercises", () => {
		const shipped = getShippedExercise(DEFAULT_EXERCISES[0]._id);
		if (!shipped) throw new Error("Missing shipped exercise");
		const merged = mergeExerciseCatalog([
			{ ...shipped, _id: "personal-id", isDefault: false },
		]);
		expect(merged).toHaveLength(DEFAULT_EXERCISES.length + 1);
		expect(
			merged
				.filter((exercise) => exercise.name === shipped.name)
				.map((exercise) => exercise._id)
				.sort(),
		).toEqual([shipped._id, "personal-id"].sort());
	});
});

describe("timed exercises", () => {
	it("name shipped bodyweight exercises, so holds never feed 1RM references", () => {
		expect(TIMED_EXERCISES.length).toBeGreaterThan(0);
		for (const id of TIMED_EXERCISES) {
			const exercise = getShippedExercise(id);
			expect(exercise, id).toBeDefined();
			expect(isLoadedEquipment(exercise?.equipment ?? "barbell"), id).toBe(
				false,
			);
		}
	});
	it("count Plank in seconds and other exercises in reps", () => {
		expect(isTimedExercise("shipped:exercise:plank")).toBe(true);
		expect(isTimedExercise("shipped:exercise:barbell-back-squat")).toBe(false);
		expect(isTimedExercise(undefined)).toBe(false);
	});
});
