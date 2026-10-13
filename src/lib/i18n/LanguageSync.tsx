import { hasExplicitLocaleChoice, SUPPORTED_LOCALES, useI18n } from "./index";
import { createLanguageSync } from "./runtime/clerk-sync";

export const LanguageSync = createLanguageSync({
	useI18n,
	hasExplicitLocaleChoice,
	locales: SUPPORTED_LOCALES,
});
