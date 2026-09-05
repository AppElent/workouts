/**
 * The phone's language, resolved once and never re-resolved behind the user's
 * back.
 *
 * **Chosen beats detected.** A saved choice wins over the device's language
 * list, which wins over English. That order lives in `resolveLocale`, which
 * comes from `@appelent/i18n/core` — the DOM-free subpath of the package the
 * web app already uses. Only `/core` is safe here: the package root reaches for
 * `document.cookie` and `navigator.language` and would throw on React Native.
 * `plural` in that subpath already guards `Intl.PluralRules`, which Hermes has
 * historically lacked.
 *
 * **Resolved before the first paint.** `useState(initialLocale)` takes the
 * *function*, so the store is read during the first render — synchronously,
 * once, before anything is drawn. An effect or an awaited read would paint one
 * frame in the wrong language, which is the specific defect #69 forbids. That
 * is also why persistence is `expo-sqlite/kv-store` and not `expo-secure-store`
 * (see `src/prefs/local-preference.ts`).
 *
 * **Mounted outside Clerk and Convex** (`app/_layout.tsx`). Language is a
 * property of this phone, not of the signed-in account: it has to apply to the
 * sign-in screen, to the offline banner, and to whatever is on screen while the
 * service is unreachable.
 *
 * There is no language control on the front door. The toggle lives behind
 * Profile → Preferences → Language, because a signed-out person has stated no
 * preference and the device decides for them.
 */
import { resolveLocale } from "@appelent/i18n/core";
import { getLocales } from "expo-localization";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useMemo,
	useState,
} from "react";
import {
	PREFERENCE_KEYS,
	readPreference,
	writePreference,
} from "../prefs/local-preference";
import { en, type Messages } from "./messages/en";
import { nl } from "./messages/nl";

export { fmt, plural } from "@appelent/i18n/core";
export type { Messages };

export const SUPPORTED_LOCALES = ["en", "nl"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const DICTIONARIES: Record<Locale, Messages> = { en, nl };

/**
 * `resolveLocale`'s third argument is a saved choice and its fourth an
 * Accept-Language-shaped string, so the device's ordered locale list is joined
 * into one. `getLocales()` is a synchronous native read on both platforms.
 */
function initialLocale(): Locale {
	return resolveLocale(
		SUPPORTED_LOCALES,
		"en",
		readPreference(PREFERENCE_KEYS.locale) ?? undefined,
		getLocales()
			.map(({ languageTag }) => languageTag)
			.join(","),
	);
}

interface I18nValue {
	locale: Locale;
	/** The message tree for the active locale. */
	t: Messages;
	setLocale: (next: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
	const [locale, setStoredLocale] = useState(initialLocale);

	const setLocale = useCallback((next: Locale) => {
		setStoredLocale(next);
		writePreference(PREFERENCE_KEYS.locale, next);
	}, []);

	const value = useMemo(
		() => ({ locale, t: DICTIONARIES[locale], setLocale }),
		[locale, setLocale],
	);

	return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
	const value = use(I18nContext);
	if (!value) {
		throw new Error("useI18n must be used within a LocaleProvider");
	}
	return value;
}
