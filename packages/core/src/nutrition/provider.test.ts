import { describe, expect, it } from "vitest";
import { parseProviderNumber, parseProviderNutrient } from "./provider";

describe("parseProviderNumber", () => {
	it.each([
		["250 kcal", 250],
		["12,5 g", 12.5],
		["1,200 kcal", 1200],
		["1046 kJ", 250],
		["740 mg", 0.74],
		[0, 0],
		[42.5, 42.5],
	])("parses %p as %p", (input, expected) => {
		expect(parseProviderNumber(input)).toBe(expected);
	});

	it.each([
		[undefined],
		[null],
		["not a number"],
		["-5 g"],
		[-5],
		[Number.NaN],
		[{}],
	])("rejects %p", (input) => {
		expect(parseProviderNumber(input)).toBeUndefined();
	});
});

describe("parseProviderNutrient", () => {
	it("reads absent from missing, null, and empty-string fields", () => {
		expect(parseProviderNutrient(undefined)).toEqual({ kind: "absent" });
		expect(parseProviderNutrient(null)).toEqual({ kind: "absent" });
		expect(parseProviderNutrient("")).toEqual({ kind: "absent" });
	});

	it("reads trace only from an explicit trace word, in English and Dutch", () => {
		expect(parseProviderNutrient("traces")).toEqual({ kind: "trace" });
		expect(parseProviderNutrient("Trace")).toEqual({ kind: "trace" });
		expect(parseProviderNutrient("sporen")).toEqual({ kind: "trace" });
	});

	it("reads a real figure as a value, never rounding it away", () => {
		expect(parseProviderNutrient("12,5 g")).toEqual({
			kind: "value",
			amount: 12.5,
		});
		expect(parseProviderNutrient(0)).toEqual({ kind: "value", amount: 0 });
	});

	it("falls back to absent for unparseable text rather than throwing", () => {
		expect(parseProviderNutrient("n/a")).toEqual({ kind: "absent" });
	});
});
