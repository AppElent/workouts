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
 * Day boundaries use the *device's* local calendar date.
 */
import { type IsoDate, isoDateFrom, type Locale } from "@foundry/core";
import { dateLocale } from "../i18n";

/** The local calendar date of an instant — not its UTC date. */
export function toIsoDate(date: Date): IsoDate {
	return isoDateFrom(date.getFullYear(), date.getMonth() + 1, date.getDate());
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

/**
 * The `[from, to)` epoch-ms bounds of this local calendar day, midnight to
 * midnight. For range-querying tables that (unlike the diary) still store
 * epoch-ms instants, such as `workoutSessions` — see the training marker in
 * `src/features/nutrition/diary/use-trained-dates.ts`. Built from midnight rather than the noon
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
 * "di 22 september" — the same date with an abbreviated weekday.
 *
 * A navigation title has one line and no room to truncate gracefully; the long
 * form ("dinsdag 22 september") loses its day number there, which is the part
 * that matters when you are logging into a past day.
 */
export function formatShortDate(iso: IsoDate, locale: Locale): string {
	try {
		return isoDateToLocalDate(iso).toLocaleDateString(dateLocale(locale), {
			weekday: "short",
			day: "numeric",
			month: "long",
		});
	} catch {
		return iso;
	}
}

/**
 * The day written out in the app language. A Hermes build without the locale
 * data throws from `Intl`; the ISO string is the fallback.
 */
export function formatLongDate(iso: IsoDate, locale: Locale): string {
	try {
		return isoDateToLocalDate(iso).toLocaleDateString(dateLocale(locale), {
			weekday: "long",
			day: "numeric",
			month: "long",
		});
	} catch {
		return iso;
	}
}
