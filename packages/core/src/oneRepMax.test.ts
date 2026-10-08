import { describe, expect, it } from "vitest";
import {
	calculateOneRepMax,
	convertLoad,
	estimatedMaxReps,
	getWeightStep,
	roundLoad,
	weightForRepMax,
} from "./oneRepMax";

// This used to be a parity test guarding against drift between a client copy
// (src/lib/oneRepMax.ts) and a server copy (convex/lib/oneRepMax.ts) of the
// same formula. Both copies were deleted in favor of this single package
// (issue #43); the test now just pins the Epley formula's behavior directly.
describe("calculateOneRepMax", () => {
	it("treats a single rep as the actual 1RM, not a calculated one", () => {
		expect(calculateOneRepMax(100, 1)).toEqual({
			value: 100,
			source: "actual",
		});
	});

	it("applies the Epley formula for reps > 1, rounded to 1 decimal", () => {
		const cases: [number, number, number][] = [
			[100, 5, 116.7],
			[62.5, 8, 79.2],
			[142.5, 3, 156.8],
			[0, 10, 0],
		];
		for (const [weight, reps, expected] of cases) {
			expect(calculateOneRepMax(weight, reps)).toEqual({
				value: expected,
				source: "calculated",
				formula: "epley",
			});
		}
	});
});

describe("strength reference calculations", () => {
	it("keeps the single-rep boundary and never predicts reps above the reference", () => {
		expect(estimatedMaxReps(100, 100)).toBe(1);
		expect(estimatedMaxReps(100, 98)).toBe(1);
		expect(estimatedMaxReps(100, 101)).toBe(0);
		expect(estimatedMaxReps(100, 75)).toBe(10);
		expect(estimatedMaxReps(0, 0)).toBeNull();
		expect(estimatedMaxReps(100, 0)).toBeNull();
	});
	it("uses Epley without RPE correction and rounds the actual suggested load", () => {
		expect(weightForRepMax(100, 1)).toBe(100);
		expect(weightForRepMax(100, 10)).toBe(75);
		expect(roundLoad(weightForRepMax(100, 8), 2.5)).toBe(80);
		expect(roundLoad(81, getWeightStep("dumbbell", 2))).toBe(82);
		expect(convertLoad(200, "lbs", "kg")).toBeCloseTo(90.718474);
		expect(convertLoad(convertLoad(100, "kg", "lbs"), "lbs", "kg")).toBeCloseTo(
			100,
		);
	});
});
