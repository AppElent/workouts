import { describe, expect, it } from "vitest";
import { mealSlotAt } from "./meal-time";

const at = (hour: number, minute = 0) => new Date(2026, 9, 7, hour, minute);

describe("mealSlotAt", () => {
	it("follows the day: breakfast, lunch, dinner, snacks in between", () => {
		expect(mealSlotAt(at(7))).toBe("breakfast");
		expect(mealSlotAt(at(10, 29))).toBe("breakfast");
		expect(mealSlotAt(at(12))).toBe("lunch");
		expect(mealSlotAt(at(15, 30))).toBe("snacks");
		expect(mealSlotAt(at(18))).toBe("dinner");
		expect(mealSlotAt(at(22))).toBe("snacks");
		expect(mealSlotAt(at(2))).toBe("snacks");
	});
});
