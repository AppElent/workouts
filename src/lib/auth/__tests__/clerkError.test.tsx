// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type Locale, LocaleProvider } from "#/lib/i18n";
import { useClerkErrorMessage } from "../clerkError";

afterEach(cleanup);

function messageFor(locale: Locale, error: unknown): string {
	const { result } = renderHook(() => useClerkErrorMessage(), {
		wrapper: ({ children }) => (
			<LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
		),
	});
	return result.current(error);
}

const unmapped = {
	errors: [
		{
			code: "form_identifier_not_allowed",
			message: "Not allowed.",
			longMessage: "This identifier is not allowed.",
		},
	],
};

describe("useClerkErrorMessage", () => {
	it("translates a mapped code on a Dutch page", () => {
		expect(
			messageFor("nl", { errors: [{ code: "form_password_incorrect" }] }),
		).toBe("Dit wachtwoord klopt niet.");
	});

	it("shows the Dutch generic message for an unmapped code (APP-538)", () => {
		expect(messageFor("nl", unmapped)).toBe(
			"Er ging iets mis. Probeer het opnieuw.",
		);
	});

	it("keeps Clerk's own text for an unmapped code on an English page", () => {
		expect(messageFor("en", unmapped)).toBe("This identifier is not allowed.");
	});

	it("falls back to the English generic message without Clerk text", () => {
		expect(messageFor("en", { errors: [{ code: "unknown" }] })).toBe(
			messageFor("en", null),
		);
	});
});
