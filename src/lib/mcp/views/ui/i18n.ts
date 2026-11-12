import {
	fmt,
	type Locale,
	plural,
	resolveLocale,
	SUPPORTED_LOCALES,
} from "@foundry/core";
import { mcpViews as en } from "#/lib/i18n/messages/en/mcp-views";
import { mcpViews as nl } from "#/lib/i18n/messages/nl/mcp-views";

export type ViewMessages = typeof en;

const CATALOG: Record<Locale, ViewMessages> = { en, nl };

export type ViewText = {
	locale: Locale;
	t: ViewMessages;
	fmt: typeof fmt;
	plural: (count: number, forms: { one: string; other: string }) => string;
	number: (value: number, digits?: number) => string;
	/** A calendar day (YYYY-MM-DD) in the given style. */
	day: (date: string, style: DayStyle) => string;
};

type DayStyle = "weekday" | "short" | "shortYear" | "long";

const DAY_STYLES: Record<DayStyle, Intl.DateTimeFormatOptions> = {
	weekday: { weekday: "short", day: "numeric" },
	short: { day: "numeric", month: "short" },
	shortYear: { day: "numeric", month: "short", year: "numeric" },
	long: { weekday: "long", day: "numeric", month: "long" },
};

/** Copy and formatting for the host's language; English when unsupported. */
export function viewText(hostLocale: string | undefined): ViewText {
	const locale = resolveLocale(SUPPORTED_LOCALES, "en", undefined, hostLocale);
	return {
		locale,
		t: CATALOG[locale],
		fmt,
		plural: (count, forms) => plural(locale, count, forms),
		number: (value, digits = 0) =>
			new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(
				value,
			),
		day: (date, style) =>
			new Intl.DateTimeFormat(locale, {
				...DAY_STYLES[style],
				timeZone: "UTC",
			}).format(new Date(`${date}T00:00:00Z`)),
	};
}
