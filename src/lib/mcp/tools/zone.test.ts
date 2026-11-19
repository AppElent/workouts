import { describe, expect, it } from "vitest";
import {
	isTimeZone,
	startOfZoneDay,
	zoneDate,
	zoneOffsetMinutes,
} from "./zone";

describe("calendar days in a time zone", () => {
	it("moves an evening instant to the next local day east of UTC", () => {
		const ms = Date.parse("2026-11-19T23:30:00Z");
		expect(zoneDate(ms)).toBe("2026-11-19");
		expect(zoneDate(ms, "Europe/Amsterdam")).toBe("2026-11-20");
		expect(zoneDate(ms, "America/Los_Angeles")).toBe("2026-11-19");
		expect(
			zoneDate(Date.parse("2026-11-19T03:00:00Z"), "America/New_York"),
		).toBe("2026-11-18");
	});

	it("follows daylight saving time", () => {
		expect(
			zoneOffsetMinutes(Date.parse("2026-01-15T12:00:00Z"), "Europe/Amsterdam"),
		).toBe(60);
		expect(
			zoneOffsetMinutes(Date.parse("2026-07-15T12:00:00Z"), "Europe/Amsterdam"),
		).toBe(120);
		expect(zoneOffsetMinutes(Date.parse("2026-07-15T12:00:00Z"))).toBe(0);
	});

	it("finds where a local day starts, also on a DST change day", () => {
		expect(startOfZoneDay("2026-11-19")).toBe(
			Date.parse("2026-11-19T00:00:00Z"),
		);
		expect(startOfZoneDay("2026-11-19", "Europe/Amsterdam")).toBe(
			Date.parse("2026-11-18T23:00:00Z"),
		);
		// 2026-10-25: Amsterdam leaves summer time at 03:00, midnight is still +02:00.
		expect(startOfZoneDay("2026-10-25", "Europe/Amsterdam")).toBe(
			Date.parse("2026-10-24T22:00:00Z"),
		);
		expect(startOfZoneDay("2026-10-26", "Europe/Amsterdam")).toBe(
			Date.parse("2026-10-25T23:00:00Z"),
		);
	});

	it("recognises IANA names only", () => {
		expect(isTimeZone("Europe/Amsterdam")).toBe(true);
		expect(isTimeZone("Not/AZone")).toBe(false);
	});
});
