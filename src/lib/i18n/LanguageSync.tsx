import { useUser } from "@clerk/react";
import { isLocale, SUPPORTED_LOCALES } from "@foundry/core";
import { useEffect } from "react";
import { hasExplicitLocaleChoice, useI18n } from "./index";

/**
 * Mirrors an explicit locale choice into Clerk's `unsafeMetadata.language` so
 * it follows a signed-in user across devices. The cookie stays the source of
 * truth for an explicit choice.
 */
export function LanguageSync() {
	const { user } = useUser();
	const { locale, setLocale } = useI18n();
	const userId = user?.id;

	// biome-ignore lint/correctness/useExhaustiveDependencies: `user` identity changes on every update() — keying on userId/locale is deliberate to avoid a sync loop.
	useEffect(() => {
		if (!user) return;
		const saved = user.unsafeMetadata?.language;
		const savedLocale = isLocale(SUPPORTED_LOCALES, saved) ? saved : undefined;
		if (savedLocale === locale) return;
		if (savedLocale && !hasExplicitLocaleChoice()) {
			setLocale(savedLocale);
			return;
		}
		user.updateMetadata({ unsafeMetadata: { language: locale } }).catch(() => {
			// Best-effort mirror; the cookie already holds the choice locally.
		});
	}, [userId, locale, setLocale]);

	return null;
}
