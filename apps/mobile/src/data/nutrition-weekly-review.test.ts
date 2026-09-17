import {
	canGoToNextWeek,
	evaluateNutrientGoal,
	weekDates,
	weekStartMonday,
} from "./nutrition-weekly-review";

describe("Week overview helpers", () => {
	it("builds a stable Monday-to-Sunday week and stops after the current week", () => {
		expect(weekStartMonday("2026-09-13")).toBe("2026-09-07");
		expect(weekDates("2026-09-07")).toEqual([
			"2026-09-07",
			"2026-09-08",
			"2026-09-09",
			"2026-09-10",
			"2026-09-11",
			"2026-09-12",
			"2026-09-13",
		]);
		expect(canGoToNextWeek("2026-08-31", "2026-09-09")).toBe(true);
		expect(canGoToNextWeek("2026-09-07", "2026-09-09")).toBe(false);
	});

	it("evaluates minimum, maximum, range, and no-goal values", () => {
		expect(evaluateNutrientGoal(90, false, [])).toMatchObject({
			status: "noGoal",
		});
		expect(
			evaluateNutrientGoal(90, false, [
				{ nutrient: "protein", direction: "min", target: 100 },
			]),
		).toMatchObject({ status: "below", minimum: 100 });
		expect(
			evaluateNutrientGoal(100, false, [
				{ nutrient: "protein", direction: "min", target: 100 },
			]),
		).toMatchObject({ status: "met" });
		expect(
			evaluateNutrientGoal(2000, false, [
				{ nutrient: "energy", direction: "max", target: 2000 },
			]),
		).toMatchObject({ status: "within", maximum: 2000 });
		expect(
			evaluateNutrientGoal(2201, false, [
				{ nutrient: "energy", direction: "max", target: 2000 },
			]),
		).toMatchObject({ status: "exceeded" });
		expect(
			evaluateNutrientGoal(1800, false, [
				{ nutrient: "energy", direction: "min", target: 1800 },
				{ nutrient: "energy", direction: "max", target: 2200 },
			]),
		).toMatchObject({ status: "within", minimum: 1800, maximum: 2200 });
	});

	it("uses incomplete lower bounds only for certain maximum violations", () => {
		const range = [
			{ nutrient: "energy" as const, direction: "min" as const, target: 1800 },
			{ nutrient: "energy" as const, direction: "max" as const, target: 2200 },
		];
		expect(evaluateNutrientGoal(1700, true, range).status).toBe("incomplete");
		expect(evaluateNutrientGoal(2000, true, range).status).toBe("incomplete");
		expect(evaluateNutrientGoal(2201, true, range).status).toBe("exceeded");
		expect(evaluateNutrientGoal(25, true, []).status).toBe("incomplete");
	});
});
