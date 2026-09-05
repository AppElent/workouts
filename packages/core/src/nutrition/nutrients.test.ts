import { describe, expect, test } from "vitest";
import {
	type NutrientContribution,
	totalNutrient,
	totalNutrients,
} from "./aggregate";
import {
	ABSENT,
	NUTRIENT_KEYS,
	numericAmount,
	nutrientValue,
	roundForDisplay,
	SHIPPED_NUTRIENT_KEYS,
	TRACE,
} from "./nutrients";
import { isDerivedNutrient, saltFromSodium } from "./salt";

describe("the nutrient vocabulary", () => {
	test("is the eight the spec names, spelled the way the spec spells them", () => {
		expect([...NUTRIENT_KEYS]).toEqual([
			"energy",
			"protein",
			"carbs",
			"fat",
			"saturatedFat",
			"fibre",
			"sugars",
			"salt",
		]);
	});

	test("carries sodium on shipped foods without making it a ninth nutrient", () => {
		expect(SHIPPED_NUTRIENT_KEYS).toContain("sodium");
		expect(NUTRIENT_KEYS).not.toContain("sodium");
	});
});

describe("reading a nutrient value", () => {
	test("gives a trace the number zero so arithmetic still works", () => {
		expect(numericAmount(TRACE)).toBe(0);
	});

	test("gives an absent value no number at all, so it cannot read as zero", () => {
		expect(numericAmount(ABSENT)).toBeUndefined();
	});
});

describe("rounding", () => {
	test("rounds energy to whole kcal and macros to a tenth", () => {
		expect(roundForDisplay("energy", 88.4)).toBe(88);
		expect(roundForDisplay("protein", 2.34)).toBe(2.3);
	});

	test("keeps two decimals for salt, where a tenth would hide the difference", () => {
		expect(roundForDisplay("salt", 0.005)).toBe(0.01);
		expect(roundForDisplay("salt", 0.4123)).toBe(0.41);
	});
});

describe("deriving salt from sodium", () => {
	test("uses the inverse of NEVO's own conversion factor", () => {
		expect(saltFromSodium(nutrientValue(400))).toEqual({
			kind: "value",
			amount: 1,
		});
		expect(saltFromSodium(nutrientValue(2))).toEqual({
			kind: "value",
			amount: 0.005,
		});
	});

	test("gives absent salt for absent sodium, never a zero", () => {
		expect(saltFromSodium(ABSENT)).toEqual({ kind: "absent" });
	});

	test("gives trace salt for trace sodium", () => {
		expect(saltFromSodium(TRACE)).toEqual({ kind: "trace" });
	});

	test("marks salt, and only salt, as something Workouts derived", () => {
		expect(isDerivedNutrient("salt")).toBe(true);
		expect(isDerivedNutrient("sodium")).toBe(false);
		expect(isDerivedNutrient("protein")).toBe(false);
	});
});

describe("totalling a nutrient across entries", () => {
	test("adds the values", () => {
		const total = totalNutrient([nutrientValue(10), nutrientValue(2.5)]);
		expect(total.amount).toBe(12.5);
		expect(total.qualified).toBe(false);
		expect(total.incomplete).toBe(false);
	});

	test("lets a trace contribute zero while qualifying the total", () => {
		const total = totalNutrient([nutrientValue(10), TRACE]);
		expect(total.amount).toBe(10);
		expect(total.traceCount).toBe(1);
		expect(total.qualified).toBe(true);
		// A trace is a real reading, so the total is not missing anything.
		expect(total.incomplete).toBe(false);
	});

	test("still shows a total built from incomplete entries, but marks it", () => {
		const total = totalNutrient([nutrientValue(10), ABSENT]);
		expect(total.amount).toBe(10);
		expect(total.absentCount).toBe(1);
		expect(total.incomplete).toBe(true);
		expect(total.qualified).toBe(true);
	});

	test("treats a day with nothing logged as a neutral zero, not an incomplete one", () => {
		const total = totalNutrient([]);
		expect(total.amount).toBe(0);
		expect(total.entryCount).toBe(0);
		expect(total.incomplete).toBe(false);
		expect(total.qualified).toBe(false);
	});
});

describe("totalling a day", () => {
	const day: NutrientContribution[] = [
		{ energy: nutrientValue(200), protein: nutrientValue(10), salt: TRACE },
		{ energy: nutrientValue(150), protein: ABSENT, salt: nutrientValue(0.4) },
	];

	test("reports every one of the eight, whether or not an entry mentioned it", () => {
		const totals = totalNutrients(day);
		expect(Object.keys(totals).sort()).toEqual([...NUTRIENT_KEYS].sort());
	});

	test("counts a nutrient an entry never mentioned as unknown, not as zero", () => {
		const totals = totalNutrients(day);
		expect(totals.fibre.incomplete).toBe(true);
		expect(totals.fibre.absentCount).toBe(2);
	});

	test("keeps trace and absence separate in the day total", () => {
		const totals = totalNutrients(day);
		expect(totals.energy).toMatchObject({
			amount: 350,
			incomplete: false,
			qualified: false,
		});
		expect(totals.protein).toMatchObject({ amount: 10, incomplete: true });
		expect(totals.salt).toMatchObject({
			amount: 0.4,
			traceCount: 1,
			incomplete: false,
			qualified: true,
		});
	});
});
