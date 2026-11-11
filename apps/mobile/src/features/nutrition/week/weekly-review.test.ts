import { canGoToNextWeek, weekDates } from "./weekly-review";

describe("Week overview helpers", () => {
	it("builds a stable Monday-to-Sunday week and stops after the current week", () => {
		expect(weekDates("2026-09-07")).toEqual([
			"2026-09-07",
			"2026-09-08",
			"2026-09-09",
			"2026-09-10",
			"2026-09-11",
			"2026-09-12",
			"2026-09-13",
		]);
		expect(canGoToNextWeek("2026-08-31", "2026-09-09")).toBe(true);
		expect(canGoToNextWeek("2026-09-07", "2026-09-09")).toBe(false);
	});
});
