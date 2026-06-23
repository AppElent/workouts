import { describe, expect, it } from "vitest";
import { calcPlates, DEFAULT_BAR, generateWarmup } from "./plates";

describe("calcPlates", () => {
	it("breaks 100kg on a 20kg bar into 40kg per side (greedy)", () => {
		const r = calcPlates(100, DEFAULT_BAR.kg, "kg");
		expect(r.belowBar).toBe(false);
		expect(r.remainder).toBe(0);
		// 40kg/side, heaviest-first: 25 + 15
		expect(r.perSide).toEqual([25, 15]);
		expect(r.perSide.reduce((a, b) => a + b, 0)).toBe(40);
	});

	it("uses the smallest plates for fine increments", () => {
		const r = calcPlates(62.5, DEFAULT_BAR.kg, "kg");
		// 21.25 per side = 20 + 1.25
		expect(r.perSide).toEqual([20, 1.25]);
		expect(r.remainder).toBe(0);
	});

	it("reports a remainder when not loadable", () => {
		const r = calcPlates(61, DEFAULT_BAR.kg, "kg");
		// 20.5 per side -> 20, remainder 0.5 per side => 1kg total
		expect(r.perSide).toEqual([20]);
		expect(r.remainder).toBe(1);
	});

	it("flags weights below the bar", () => {
		const r = calcPlates(15, DEFAULT_BAR.kg, "kg");
		expect(r.belowBar).toBe(true);
		expect(r.perSide).toEqual([]);
	});

	it("works for lbs", () => {
		const r = calcPlates(135, DEFAULT_BAR.lbs, "lbs");
		// (135-45)/2 = 45 per side
		expect(r.perSide).toEqual([45]);
		expect(r.remainder).toBe(0);
	});
});

describe("generateWarmup", () => {
	it("starts with the empty bar and ramps to the work weight", () => {
		const sets = generateWarmup(100, DEFAULT_BAR.kg, "kg");
		expect(sets[0]).toEqual({ weight: 20, reps: 8, pct: null });
		expect(sets.length).toBeGreaterThan(1);
		for (const s of sets) expect(s.weight).toBeLessThanOrEqual(100);
	});

	it("returns nothing when the work weight is the bar or lighter", () => {
		expect(generateWarmup(20, DEFAULT_BAR.kg, "kg")).toEqual([]);
	});
});
