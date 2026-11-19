import { z } from "zod";

const UTC = "UTC";

export function isTimeZone(value: string): boolean {
	try {
		new Intl.DateTimeFormat("en", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

/** Optional IANA zone for tools that group by calendar day. */
export const timeZoneInput = z
	.string()
	.max(64)
	.refine(isTimeZone, "timeZone must be an IANA name such as Europe/Amsterdam.")
	.optional()
	.describe(
		"IANA time zone of the user, such as Europe/Amsterdam, for calendar days. UTC when omitted. Views fill it in from the host.",
	);

function wallClock(ms: number, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).formatToParts(ms);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);
	return {
		year: value("year"),
		month: value("month"),
		day: value("day"),
		hour: value("hour"),
		minute: value("minute"),
		second: value("second"),
	};
}

/** The calendar day (`YYYY-MM-DD`) an instant falls on in `timeZone`. */
export function zoneDate(ms: number, timeZone = UTC): string {
	const { year, month, day } = wallClock(ms, timeZone);
	return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Minutes east of UTC that `timeZone` is at an instant (CET is 60). */
export function zoneOffsetMinutes(ms: number, timeZone = UTC): number {
	const { year, month, day, hour, minute, second } = wallClock(ms, timeZone);
	const wall = Date.UTC(year, month - 1, day, hour, minute, second);
	return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60_000);
}

/** The instant a calendar day starts in `timeZone`. */
export function startOfZoneDay(day: string, timeZone = UTC): number {
	const utc = Date.parse(`${day}T00:00:00Z`);
	// The offset at the guess may differ from the offset at midnight itself
	// (a DST change in between), so settle it in a second step.
	const first = utc - zoneOffsetMinutes(utc, timeZone) * 60_000;
	return utc - zoneOffsetMinutes(first, timeZone) * 60_000;
}
