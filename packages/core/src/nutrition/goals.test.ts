import { describe, expect, it } from "vitest";
import type { NutrientTotal } from "./aggregate";
import {
	editedGoalCount,
	evaluateGoal,
	goalBounds,
	type NutritionGoal,
	type NutritionGoalValue,
	resolveGoalHistory,
	validateNutritionGoals,
} from "./goals";

describe("nutrition goal presets", () => {
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

describe("validateNutritionGoals", () => {
	const goal = (
		nutrient: NutritionGoalValue["nutrient"],
		direction: NutritionGoalValue["direction"],
		target: number,
	): NutritionGoalValue => ({ nutrient, direction, target });

	it("accepts a positive, capped goal set with min at or below max", () => {
		const goals = [goal("energy", "min", 1800), goal("energy", "max", 1800)];
		expect(validateNutritionGoals(goals)).toEqual({ ok: true, value: goals });
	});

	it("reports each broken bound by nutrient and direction", () => {
		const result = validateNutritionGoals([
			goal("energy", "max", Number.NaN),
			goal("protein", "min", 100_001),
			goal("fibre", "min", 30),
			goal("fibre", "min", 25),
			goal("salt", "min", 6),
			goal("salt", "max", 5),
		]);
		expect(result.ok ? [] : result.errors).toEqual([
			{ field: "energy.max", code: "notPositive" },
			{ field: "protein.min", code: "tooLarge" },
			{ field: "fibre.min", code: "duplicate" },
			{ field: "salt.range", code: "minAboveMax" },
		]);
	});

	it("allows at most one min and one max per nutrient", () => {
		const tooMany = Array.from({ length: 17 }, (_, index) =>
			goal("protein", index % 2 ? "max" : "min", index + 1),
		);
		const result = validateNutritionGoals(tooMany);
		expect(result.ok ? [] : result.errors[0]).toEqual({
			field: "goals",
			code: "tooMany",
		});
	});
});

describe("resolveGoalHistory", () => {
	const energy = (target: number): NutritionGoal => ({
		nutrient: "energy",
		direction: "max",
		target,
	});

	it("uses the latest version in force on the day", () => {
		expect(
			resolveGoalHistory({
				date: "2026-03-10",
				legacyGoals: [energy(1500)],
				versions: [
					{ effectiveFrom: "2026-03-01", goals: [energy(2000)] },
					{ effectiveFrom: "2026-03-10", goals: [energy(2100)] },
					{ effectiveFrom: "2026-03-11", goals: [energy(2200)] },
				],
			}),
		).toEqual({
			goals: [energy(2100)],
			basis: "effective",
			effectiveFrom: "2026-03-10",
		});
	});

	it("returns earlier goals only as a labelled reference", () => {
		expect(
			resolveGoalHistory({
				date: "2028-02-29",
				legacyGoals: [energy(1500)],
				versions: [{ effectiveFrom: "2028-03-01", goals: [energy(2000)] }],
				referenceGoals: [energy(1900)],
			}),
		).toEqual({
			goals: [energy(1900)],
			basis: "reference",
			effectiveFrom: null,
		});
	});

	it("rejects a date that is not on the calendar", () => {
		expect(() =>
			resolveGoalHistory({ date: "2026-02-30", legacyGoals: [], versions: [] }),
		).toThrow(expect.objectContaining({ field: "date", code: "invalid" }));
	});
});

describe("evaluateGoal", () => {
	const total = (
		amount: number,
		extra: Partial<NutrientTotal> = {},
	): NutrientTotal => ({
		amount,
		entryCount: 1,
		valueCount: 1,
		traceCount: 0,
		absentCount: 0,
		incomplete: false,
		qualified: false,
		...extra,
	});

	it("is neutral without a goal or without anything logged", () => {
		expect(evaluateGoal({}, total(100)).status).toBe("noGoal");
		expect(evaluateGoal({ max: 2000 }, undefined).status).toBe("empty");
		expect(
			evaluateGoal({ max: 2000 }, total(0, { entryCount: 0 })).status,
		).toBe("empty");
	});

	it("reads a minimum and a range at their boundaries", () => {
		expect(evaluateGoal({ min: 100 }, total(99))).toEqual({
			status: "below",
			approximate: false,
			toMinimum: 1,
		});
		expect(evaluateGoal({ min: 100 }, total(100)).status).toBe("met");
		expect(evaluateGoal({ min: 100, max: 150 }, total(150))).toEqual({
			status: "within",
			approximate: false,
			toMaximum: 0,
		});
		expect(evaluateGoal({ max: 150 }, total(151))).toEqual({
			status: "exceeded",
			approximate: false,
			over: 1,
		});
	});

	it("calls an incomplete total over its maximum exceeded, since more only adds", () => {
		expect(
			evaluateGoal(
				{ max: 150 },
				total(160, { incomplete: true, qualified: true }),
			),
		).toEqual({ status: "exceeded", approximate: true, over: 10 });
		expect(
			evaluateGoal(
				{ min: 100 },
				total(160, { incomplete: true, qualified: true }),
			).status,
		).toBe("incomplete");
	});

	it("flags an approximate total", () => {
		expect(
			evaluateGoal({ min: 100 }, total(120, { qualified: true })).approximate,
		).toBe(true);
	});
});

describe("goalBounds", () => {
	it("pairs each nutrient's bounds in display order", () => {
		expect(
			goalBounds(
				[
					{ nutrient: "protein", direction: "min", target: 100 },
					{ nutrient: "energy", direction: "max", target: 2000 },
					{ nutrient: "energy", direction: "min", target: 1500 },
				],
				["protein", "energy", "fat"],
			),
		).toEqual([
			{ nutrient: "protein", min: 100 },
			{ nutrient: "energy", min: 1500, max: 2000 },
		]);
	});
});
