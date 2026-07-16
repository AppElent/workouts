import { createI18n } from "@appelent/i18n";
import { en, type Messages } from "./messages/en";
import { nl } from "./messages/nl";

export const SUPPORTED_LOCALES = ["en", "nl"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type { Messages };

export const {
	LocaleProvider,
	useI18n,
	useMessages,
	readClientLocale,
	hasExplicitLocaleChoice,
} = createI18n<Locale, Messages>({
	locales: SUPPORTED_LOCALES,
	fallback: "en",
	messages: { en, nl },
});

export { fmt, plural } from "@appelent/i18n";
