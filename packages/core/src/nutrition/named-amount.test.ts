import { describe, expect, it } from "vitest";
import { validateNamedAmount } from "./named-amount";

describe("validateNamedAmount", () => {
	it("trims the name and folds its case for uniqueness", () => {
		expect(
			validateNamedAmount({ name: "  My Mug ", amount: 250 }, "measure"),
		).toEqual({
			ok: true,
			value: { name: "My Mug", normalizedName: "my mug", amount: 250 },
		});
	});

	it("bounds the name and the amount", () => {
		expect(validateNamedAmount({ name: " ", amount: 0 }, "serving")).toEqual({
			ok: false,
			errors: [
				{ field: "name", code: "required" },
				{ field: "amount", code: "notPositive" },
			],
		});
		const result = validateNamedAmount(
			{ name: "x".repeat(41), amount: 10_000.5 },
			"serving",
		);
		expect(result.ok ? [] : result.errors).toEqual([
			{ field: "name", code: "tooLong" },
			{ field: "amount", code: "tooLarge" },
		]);
		expect(
			validateNamedAmount({ name: "x".repeat(40), amount: 10_000 }, "serving")
				.ok,
		).toBe(true);
	});

	it("allows one decimal place on a Personal Measure only", () => {
		expect(
			validateNamedAmount({ name: "Cup", amount: 12.5 }, "measure").ok,
		).toBe(true);
		expect(
			validateNamedAmount({ name: "Cup", amount: 12.55 }, "measure"),
		).toEqual({ ok: false, errors: [{ field: "amount", code: "tooPrecise" }] });
		expect(
			validateNamedAmount({ name: "Slice", amount: 12.55 }, "serving").ok,
		).toBe(true);
	});
});
