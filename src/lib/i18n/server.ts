import { createServerFn } from "@tanstack/react-start";
import { type Locale, SUPPORTED_LOCALES } from "./index";

// Start transforms app-local server functions, but cannot strip a factory's
// handler inside a published dependency. Keep the shared helper behind this
// seam so its server-only imports never execute in the browser bundle.
export const getSsrLocale = createServerFn({ method: "GET" }).handler(
	async () => {
		const { createGetSsrLocale } = await import("@appelent/i18n/server");
		return createGetSsrLocale(SUPPORTED_LOCALES, "en" satisfies Locale)();
	},
);
