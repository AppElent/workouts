import {
	DEFAULT_LOCALE,
	resolveLocale,
	SUPPORTED_LOCALES,
} from "@foundry/core";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { LOCALE_COOKIE } from "./index";

/** The request's locale: cookie, then Accept-Language, then the default. */
export const getSsrLocale = createServerFn({ method: "GET" }).handler(() =>
	resolveLocale(
		SUPPORTED_LOCALES,
		DEFAULT_LOCALE,
		getCookie(LOCALE_COOKIE),
		getRequestHeader("accept-language"),
	),
);
