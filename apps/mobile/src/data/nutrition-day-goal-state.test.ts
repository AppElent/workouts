/**
 * What a total says about its goal.
 *
 * These four words are what makes the day readable without colour, so each one
 * is pinned: an untouched day is neutral rather than failing, a minimum
 * separates under from met, and a maximum separates within from exceeded.
 */
import { goalState } from "./nutrition-day";

describe("goal state", () => {
	it("stays neutral on a day nothing has been logged against", () => {
		expect(goalState("min", 0, 140)).toBe("neutral");
		expect(goalState("max", 0, 2100)).toBe("neutral");
		expect(goalState("min", undefined, 140)).toBe("neutral");
	});

	it("separates under from met on a minimum", () => {
		expect(goalState("min", 139, 140)).toBe("under");
		expect(goalState("min", 140, 140)).toBe("met");
		expect(goalState("min", 200, 140)).toBe("met");
	});

	it("separates within from exceeded on a maximum", () => {
		expect(goalState("max", 2099, 2100)).toBe("within");
		expect(goalState("max", 2100, 2100)).toBe("within");
		expect(goalState("max", 2101, 2100)).toBe("exceeded");
	});
});
