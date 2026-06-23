import { describe, expect, it } from "vitest";
import { calculateOneRepMax as convexCalc } from "../../convex/lib/oneRepMax";
import { calculateOneRepMax as clientCalc } from "./oneRepMax";

// Guards against silent drift between the client and server Epley
// implementations — divergence would corrupt user PRs (assessment item #4).
describe("1RM client/server parity", () => {
	const cases: [number, number][] = [];
	for (const weight of [0, 1, 20, 60, 62.5, 100, 142.5, 315]) {
		for (const reps of [1, 2, 3, 5, 8, 10, 12, 20]) {
			cases.push([weight, reps]);
		}
	}

	it.each(cases)("matches for weight=%s reps=%s", (weight, reps) => {
		expect(clientCalc(weight, reps)).toEqual(convexCalc(weight, reps));
	});
});
