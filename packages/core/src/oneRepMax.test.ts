import { describe, expect, it } from "vitest";
import { calculateOneRepMax } from "./oneRepMax";

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
