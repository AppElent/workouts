import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "@foundry/core";
import { rootRouteId } from "@tanstack/react-router";
import { MESSAGES, type Messages } from "./index";

/**
 * A localized `<title>` for a route's `head`. `head` runs outside React, so it
 * reads the locale the root loader resolved (cookie, then browser language).
 */
export function pageTitle(
	matches: ReadonlyArray<{ routeId: string; loaderData?: unknown }>,
	pick: (messages: Messages) => string,
) {
	const root = matches.find((match) => match.routeId === rootRouteId);
	const locale = (root?.loaderData as { locale?: unknown } | undefined)?.locale;
	const messages =
		MESSAGES[isLocale(SUPPORTED_LOCALES, locale) ? locale : DEFAULT_LOCALE];
	return { title: `${pick(messages)} — ${messages.nav.appName}` };
}
