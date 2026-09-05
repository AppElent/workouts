import { describe, expect, it } from "vitest";
import { editedGoalCount, NUTRITION_GOAL_PRESETS } from "./goals";

describe("nutrition goal presets", () => {
	it("publishes the disclosed reference values and fixed variants", () => {
		expect(NUTRITION_GOAL_PRESETS.reference.goals).toEqual([
			{ nutrient: "energy", direction: "max", target: 2000 },
			{ nutrient: "protein", direction: "min", target: 50 },
			{ nutrient: "carbs", direction: "max", target: 260 },
			{ nutrient: "fat", direction: "max", target: 70 },
			{ nutrient: "saturatedFat", direction: "max", target: 20 },
			{ nutrient: "fibre", direction: "min", target: 25 },
			{ nutrient: "sugars", direction: "max", target: 90 },
			{ nutrient: "salt", direction: "max", target: 6 },
		]);
		expect(NUTRITION_GOAL_PRESETS.loseWeight.delta).toBe("Energy −300 kcal");
		expect(NUTRITION_GOAL_PRESETS.buildMuscle.delta).toBe(
			"Energy +300 kcal; protein +50 g",
		);
	});

	it("derives edited counts from each row's retained preset association", () => {
		expect(
			editedGoalCount("reference", [
				{ nutrient: "energy", direction: "max", sourcePreset: "reference" },
				{ nutrient: "protein", direction: "min" },
				{ nutrient: "carbs", direction: "max", sourcePreset: "buildMuscle" },
				{ nutrient: "fat", direction: "max", sourcePreset: "reference" },
				{
					nutrient: "saturatedFat",
					direction: "max",
					sourcePreset: "reference",
				},
				{ nutrient: "fibre", direction: "min", sourcePreset: "reference" },
				{ nutrient: "sugars", direction: "max", sourcePreset: "reference" },
				{ nutrient: "salt", direction: "max", sourcePreset: "reference" },
			]),
		).toBe(2);
		expect(editedGoalCount("reference", [])).toBe(8);
	});
});
