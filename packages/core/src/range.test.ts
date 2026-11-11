import { describe, expect, it } from "vitest";
import { rangeCode } from "./range";

describe("rangeCode", () => {
	it("accepts decimal multiples despite floating-point error", () => {
		expect(rangeCode(0.3, { min: 0, max: 1, step: 0.1 })).toBeNull();
		expect(rangeCode(2.5, { min: 0, max: 10, step: 0.5 })).toBeNull();
	});

	it("rejects values off the step", () => {
		expect(rangeCode(0.25, { min: 0, max: 1, step: 0.1 })).toBe("notStep");
	});

	it("reports bounds before the step", () => {
		expect(rangeCode(-1, { min: 0, max: 1, step: 0.1 })).toBe("tooSmall");
		expect(rangeCode(2, { min: 0, max: 1 })).toBe("tooLarge");
		expect(rangeCode(Number.NaN, { min: 0, max: 1 })).toBe("notNumber");
	});
});
