import { ACCOUNT_PORTAL_URL } from "@foundry/core";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "#/lib/i18n";
import { AccountPortalLink } from "./AccountPortalLink";

it.each([
	["en", "Manage your AppElent account"],
	["nl", "Beheer je AppElent-account"],
] as const)("links to the account portal in a new tab (%s)", (locale, name) => {
	render(
		<LocaleProvider initialLocale={locale}>
			<AccountPortalLink />
		</LocaleProvider>,
	);
	const link = screen.getByRole("link", { name });
	expect(link.getAttribute("href")).toBe(ACCOUNT_PORTAL_URL);
	expect(link.getAttribute("target")).toBe("_blank");
	expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});
