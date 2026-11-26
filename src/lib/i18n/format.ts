import type { Locale } from "@foundry/core";

/** A short day and month, such as "Nov 26" or "26 nov". */
export function formatShortDate(locale: Locale, at: number): string {
	return new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
	}).format(new Date(at));
}
