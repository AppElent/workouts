/**
 * Dates, in the calendar the person lives in.
 */
import {
	formatLongDate,
	isoDayOffset,
	shiftIsoDate,
	todayIsoDate,
	toIsoDate,
} from "./calendar-day";

describe("calendar days", () => {
	it("reads an instant as its local date, not its UTC date", () => {
		// 23:30 local on the 4th. In UTC this is already the 5th anywhere east of
		// Greenwich, and the diary must still call it the 4th.
		expect(toIsoDate(new Date(2026, 8, 4, 23, 30))).toBe("2026-09-04");
	});

	it("defaults to today", () => {
		expect(todayIsoDate(new Date(2026, 0, 1, 9, 0))).toBe("2026-01-01");
	});

	it("steps across a month boundary", () => {
		expect(shiftIsoDate("2026-09-01", -1)).toBe("2026-08-31");
		expect(shiftIsoDate("2026-08-31", 1)).toBe("2026-09-01");
	});

	it("steps across a year boundary", () => {
		expect(shiftIsoDate("2025-12-31", 1)).toBe("2026-01-01");
	});

	it("steps across a leap day", () => {
		expect(shiftIsoDate("2028-02-28", 1)).toBe("2028-02-29");
	});

	it("counts whole days between dates", () => {
		expect(isoDayOffset("2026-09-04", "2026-09-04")).toBe(0);
		expect(isoDayOffset("2026-09-04", "2026-09-03")).toBe(-1);
		expect(isoDayOffset("2026-09-04", "2026-09-05")).toBe(1);
		expect(isoDayOffset("2026-09-01", "2026-10-01")).toBe(30);
	});

	it("writes the day out in the active language", () => {
		expect(formatLongDate("2026-09-04", "en")).toContain("September");
		expect(formatLongDate("2026-09-04", "nl")).toContain("september");
	});
});
