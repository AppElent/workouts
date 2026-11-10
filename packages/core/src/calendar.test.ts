import { describe, expect, it } from "vitest";
import {
	isoDateAt,
	isoDateFrom,
	isoDayOffset,
	isoWeek,
	isoWeekKey,
	isRealIsoDate,
	shiftIsoDate,
	weekStartMonday,
} from "./calendar";

describe("isRealIsoDate", () => {
	it("rejects dates that do not exist and malformed strings", () => {
		expect(isRealIsoDate("2024-02-29")).toBe(true);
		expect(isRealIsoDate("2023-02-29")).toBe(false);
		expect(isRealIsoDate("2026-13-01")).toBe(false);
		expect(isRealIsoDate("2026-04-31")).toBe(false);
		expect(isRealIsoDate("2026-4-01")).toBe(false);
		expect(isRealIsoDate("2026-04-01T00:00")).toBe(false);
	});
});

describe("day arithmetic", () => {
	it("crosses month, year and DST boundaries by calendar day", () => {
		expect(shiftIsoDate("2026-12-31", 1)).toBe("2027-01-01");
		expect(shiftIsoDate("2024-03-01", -1)).toBe("2024-02-29");
		// Europe/Amsterdam springs forward on 2026-03-29.
		expect(shiftIsoDate("2026-03-28", 2)).toBe("2026-03-30");
		expect(isoDayOffset("2026-03-28", "2026-03-30")).toBe(2);
		expect(isoDayOffset("2026-01-02", "2026-01-01")).toBe(-1);
	});
	it("builds a date from 1-based parts", () => {
		expect(isoDateFrom(2026, 1, 5)).toBe("2026-01-05");
		expect(isoDateFrom(2026, 2, 29)).toBe("2026-03-01");
	});
	it("reads an instant's day at an explicit offset", () => {
		// Monday 00:30 in CET is still Sunday in UTC.
		const instant = Date.UTC(2026, 0, 4, 23, 30);
		expect(isoDateAt(instant, 0)).toBe("2026-01-04");
		expect(isoDateAt(instant, 60)).toBe("2026-01-05");
		expect(isoDateAt(Date.UTC(2026, 0, 5, 2), -300)).toBe("2026-01-04");
	});
});

describe("ISO weeks", () => {
	it("starts weeks on Monday", () => {
		expect(weekStartMonday("2026-01-04")).toBe("2025-12-29");
		expect(weekStartMonday("2026-01-05")).toBe("2026-01-05");
	});
	it("numbers weeks by the year of their Thursday", () => {
		expect(isoWeek("2021-01-03")).toEqual({ year: 2020, week: 53 });
		expect(isoWeek("2024-12-30")).toEqual({ year: 2025, week: 1 });
		expect(isoWeek("2026-01-01")).toEqual({ year: 2026, week: 1 });
		expect(isoWeekKey("2026-03-02")).toBe("2026-W10");
		expect(isoWeekKey("2026-12-31")).toBe("2026-W53");
	});
});
