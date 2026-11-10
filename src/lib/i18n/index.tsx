import {
	DEFAULT_LOCALE,
	isLocale,
	type Locale,
	resolveLocale,
	SUPPORTED_LOCALES,
} from "@foundry/core";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { en, type Messages } from "./messages/en";
import { nl } from "./messages/nl";

export { fmt } from "@foundry/core";
export type { Locale, Messages };

/** Holds an explicit language choice; the server reads it for SSR. */
export const LOCALE_COOKIE = "lang";

const MESSAGES: Record<Locale, Messages> = { en, nl };

function readLocaleCookie(): string | undefined {
	return document.cookie
		.split("; ")
		.find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`))
		?.slice(LOCALE_COOKIE.length + 1);
}

/** The browser's locale, resolved in the same order as the server's. */
export function readClientLocale(): Locale {
	return resolveLocale(
		SUPPORTED_LOCALES,
		DEFAULT_LOCALE,
		readLocaleCookie(),
		navigator.language,
	);
}

export function hasExplicitLocaleChoice(): boolean {
	return isLocale(SUPPORTED_LOCALES, readLocaleCookie());
}

type I18nValue = {
	locale: Locale;
	messages: Messages;
	setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LocaleProvider({
	initialLocale,
	children,
}: {
	initialLocale: Locale;
	children: ReactNode;
}) {
	const [locale, setLocaleState] = useState(initialLocale);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
		// biome-ignore lint/suspicious/noDocumentCookie: a synchronous write keeps the SSR locale cookie in step with this render; the async Cookie Store API is missing from older Safari.
		document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
		document.documentElement.lang = next;
	}, []);

	const value = useMemo(
		() => ({ locale, messages: MESSAGES[locale], setLocale }),
		[locale, setLocale],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
	const value = useContext(I18nContext);
	if (!value) throw new Error("useI18n must be used inside LocaleProvider");
	return value;
}

export function useMessages(): Messages {
	return useI18n().messages;
}
