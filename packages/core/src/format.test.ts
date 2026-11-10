import { describe, expect, it } from "vitest";
import { formatClock, formatDurationMinutes, formatPace } from "./format";

describe("formatClock", () => {
	it("adds hours only from an hour and drops partial seconds", () => {
		expect(formatClock(0)).toBe("0:00");
		expect(formatClock(59.9)).toBe("0:59");
		expect(formatClock(3599)).toBe("59:59");
		expect(formatClock(3600)).toBe("1:00:00");
		expect(formatClock(3767)).toBe("1:02:47");
		expect(formatClock(-5)).toBe("0:00");
		expect(formatClock(Number.NaN)).toBe("0:00");
	});
});

describe("session duration", () => {
	it("rounds to the minute and never reads as zero", () => {
		expect(formatDurationMinutes(29_000)).toBe("1m");
		expect(formatDurationMinutes(48 * 60_000)).toBe("48m");
		expect(formatDurationMinutes(59 * 60_000 + 40_000)).toBe("1h");
		expect(formatDurationMinutes(72 * 60_000)).toBe("1h 12m");
	});
});

describe("formatPace", () => {
	it("rounds to whole seconds per kilometre", () => {
		expect(formatPace(245.4)).toBe("4:05 /km");
		expect(formatPace(299.6)).toBe("5:00 /km");
		expect(formatPace(null)).toBeNull();
		expect(formatPace(Number.POSITIVE_INFINITY)).toBeNull();
	});
});
