/**
 * A calendar day, as the person living it means it.
 *
 * Days are `YYYY-MM-DD` strings and deliberately not epoch milliseconds, which
 * is what the rest of this app stores. A workout happened at an instant; a
 * diary day did not. "Tuesday" is a local calendar date, and turning it into a
 * timestamp forces a timezone choice that is wrong for somebody — most visibly
 * for anyone who logs breakfast in one zone and dinner in another, or eats at
 * 00:30. Keeping the string means the day never shifts underneath its entries.
 *
 * Everything here reads the *device's* local calendar, per the spec's "day
 * boundaries use the device's local calendar date".
 */

/** `YYYY-MM-DD` in the device's local calendar. */
export type IsoDate = string;

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/** The local calendar date of an instant — not its UTC date. */
export function toIsoDate(date: Date): IsoDate {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIsoDate(now: Date = new Date()): IsoDate {
	return toIsoDate(now);
}

/**
 * Midday local time, not midnight. A `Date` is only ever built here to be
 * formatted, and midnight is the one instant a DST transition can push onto the
 * neighbouring day.
 */
export function isoDateToLocalDate(iso: IsoDate): Date {
	const [year, month, day] = iso.split("-").map(Number);
	return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** The day `days` away from `iso`, arithmetic done in the local calendar. */
export function shiftIsoDate(iso: IsoDate, days: number): IsoDate {
	const date = isoDateToLocalDate(iso);
	date.setDate(date.getDate() + days);
	return toIsoDate(date);
}

/** Whole days from `from` to `to`: -1 is yesterday, +1 is tomorrow. */
export function isoDayOffset(from: IsoDate, to: IsoDate): number {
	const ms =
		isoDateToLocalDate(to).getTime() - isoDateToLocalDate(from).getTime();
	return Math.round(ms / 86_400_000);
}

/**
 * The `[from, to)` epoch-ms bounds of this local calendar day, midnight to
 * midnight. For range-querying tables that (unlike the diary) still store
 * epoch-ms instants, such as `workoutSessions` — see the training marker in
 * `src/data/training-marker.ts`. Built from midnight rather than the noon
 * anchor `isoDateToLocalDate` uses elsewhere: a range needs the true day
 * boundary, and `Date` normalizes the day-plus-one overflow correctly across a
 * DST transition.
 */
export function isoDateToLocalDayRangeMs(iso: IsoDate): {
	from: number;
	to: number;
} {
	const [year, month, day] = iso.split("-").map(Number);
	const from = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
	const to = new Date(year, month - 1, day + 1, 0, 0, 0, 0).getTime();
	return { from, to };
}

/**
 * The day written out for a human, in the active language.
 *
 * Wrapped because `Intl` is the one API that differs between JS engines: a
 * Hermes build without the locale data throws rather than degrading, and a
 * nutrition day that crashes over a date header would be an absurd way to lose
 * the screen. The fallback is the ISO string, which is at least unambiguous.
 */
export function formatLongDate(iso: IsoDate, locale: string): string {
	try {
		return isoDateToLocalDate(iso).toLocaleDateString(locale, {
			weekday: "long",
			day: "numeric",
			month: "long",
		});
	} catch {
		return iso;
	}
}
