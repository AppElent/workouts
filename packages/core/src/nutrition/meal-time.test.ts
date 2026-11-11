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

describe("mealSlotAt boundaries", () => {
	it.each([
		[4, 59, "snacks"],
		[5, 0, "breakfast"],
		[10, 30, "snacks"],
		[11, 30, "lunch"],
		[14, 30, "snacks"],
		[17, 0, "dinner"],
		[20, 59, "dinner"],
		[21, 0, "snacks"],
	] as const)("%i:%i is %s", (hour, minute, slot) => {
		expect(mealSlotAt(at(hour, minute))).toBe(slot);
	});
});
