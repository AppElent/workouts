import { createGetSsrLocale } from "@appelent/i18n/server";
import { type Locale, SUPPORTED_LOCALES } from "./index";

export const getSsrLocale = createGetSsrLocale(
	SUPPORTED_LOCALES,
	"en" satisfies Locale,
);
