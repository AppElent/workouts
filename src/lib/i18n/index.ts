import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from "@foundry/core";
import { en, type Messages } from "./messages/en";
import { nl } from "./messages/nl";
import { createI18n } from "./runtime";

export type { Messages };
export { type Locale, SUPPORTED_LOCALES };

export const {
	LocaleProvider,
	useI18n,
	useMessages,
	readClientLocale,
	hasExplicitLocaleChoice,
} = createI18n<Locale, Messages>({
	locales: SUPPORTED_LOCALES,
	fallback: DEFAULT_LOCALE,
	messages: { en, nl },
});

export { fmt, plural } from "./runtime";
