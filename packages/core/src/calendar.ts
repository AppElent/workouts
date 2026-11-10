/**
 * Calendar days as `YYYY-MM-DD`. A day is what the person living it means by
 * "Tuesday", not an instant, so nothing here reads a timezone: arithmetic runs
 * on UTC dates, and callers convert an instant with their own offset.
 */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function pad(value: number, width = 2) {
	return String(value).padStart(width, "0");
}

function parts(date: IsoDate) {
	const match = ISO_DATE.exec(date);
	if (!match) throw new RangeError(`Not an ISO date: ${date}`);
	return {
		year: Number(match[1]),
		month: Number(match[2]),
		day: Number(match[3]),
	};
}

function fromUtc(ms: number): IsoDate {
	const date = new Date(ms);
	return isoDateFrom(
		date.getUTCFullYear(),
		date.getUTCMonth() + 1,
		date.getUTCDate(),
	);
}

function toUtc(date: IsoDate) {
	const { year, month, day } = parts(date);
	return Date.UTC(year, month - 1, day);
}

/** `month` is 1-based. Out-of-range parts roll over (Jan 32 is Feb 1). */
export function isoDateFrom(year: number, month: number, day: number): IsoDate {
	const date = new Date(Date.UTC(year, month - 1, day));
	return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * The calendar day of an instant at a fixed UTC offset in minutes (east
 * positive: CET is 60). Pass the offset that applied at that instant.
 */
export function isoDateAt(instantMs: number, offsetMinutes: number): IsoDate {
	return fromUtc(instantMs + offsetMinutes * 60_000);
}

/** This device's UTC offset at an instant, in `isoDateAt`'s convention. */
export function deviceUtcOffsetMinutes(instantMs = Date.now()): number {
	return -new Date(instantMs).getTimezoneOffset();
}

/** A well-formed date that exists on the calendar (no Feb 30). */
export function isRealIsoDate(value: string): value is IsoDate {
	const match = ISO_DATE.exec(value);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

export function shiftIsoDate(date: IsoDate, days: number): IsoDate {
	return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole days from `from` to `to`: -1 is the day before. */
export function isoDayOffset(from: IsoDate, to: IsoDate): number {
	return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 0 is Monday, 6 is Sunday. */
export function isoWeekday(date: IsoDate): number {
	return (new Date(toUtc(date)).getUTCDay() + 6) % 7;
}

/** The Monday that starts the week containing `date`. */
export function weekStartMonday(date: IsoDate): IsoDate {
	return shiftIsoDate(date, -isoWeekday(date));
}

/** ISO 8601 week-numbering year and week of `date`. */
export function isoWeek(date: IsoDate): { year: number; week: number } {
	const thursday = shiftIsoDate(date, 3 - isoWeekday(date));
	const { year } = parts(thursday);
	const week =
		Math.floor(isoDayOffset(isoDateFrom(year, 1, 1), thursday) / 7) + 1;
	return { year, week };
}

/** `2026-W02`; sorts chronologically as a string. */
export function isoWeekKey(date: IsoDate): string {
	const { year, week } = isoWeek(date);
	return `${pad(year, 4)}-W${pad(week)}`;
}
