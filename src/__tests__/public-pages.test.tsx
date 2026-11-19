import { render, screen, within } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { vi } from "vitest";
import { LocaleProvider, MESSAGES } from "#/lib/i18n";

// Routes live in src/routes, where a test file would become a route, so the
// public pages are tested from here with the router reduced to what they use.
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => ({ options }),
	Link: ({
		to,
		children,
		...rest
	}: { to: string; children: ReactNode } & Record<string, unknown>) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
	rootRouteId: "__root__",
}));

import { Route as PrivacyRoute } from "#/routes/privacy";
import { Route as SupportRoute } from "#/routes/support";

type PageRoute = {
	options: {
		component: () => ReactElement;
		head: (context: { matches: unknown[] }) => { meta: { title: string }[] };
	};
};
const support = SupportRoute as unknown as PageRoute;
const privacy = PrivacyRoute as unknown as PageRoute;

const rootMatch = (locale: unknown) => [
	{ routeId: "__root__", loaderData: { locale } },
];
const titleOf = (page: PageRoute, matches: unknown[]) =>
	page.options.head({ matches }).meta[0].title;

describe("/support", () => {
	for (const locale of ["en", "nl"] as const) {
		const copy = MESSAGES[locale].support;

		it(`renders the heading, contact, every FAQ item and the privacy link in ${locale}`, () => {
			const Page = support.options.component;
			render(
				<LocaleProvider initialLocale={locale}>
					<Page />
				</LocaleProvider>,
			);
			expect(
				screen.getByRole("heading", { level: 1, name: copy.title }),
			).toBeTruthy();
			expect(
				screen
					.getByRole("link", { name: copy.contactLabel })
					.getAttribute("href"),
			).toMatch(/^mailto:privacy@appelent\.nl/);
			const items = Object.values(copy.faq.items);
			expect(items.length).toBeGreaterThan(0);
			for (const { q, a } of items) {
				const question = screen.getByRole("heading", { level: 3, name: q });
				expect(
					within(question.parentElement as HTMLElement).getByText(a),
				).toBeTruthy();
			}
			expect(
				screen
					.getByRole("link", { name: copy.privacyLink })
					.getAttribute("href"),
			).toBe("/privacy");
		});
	}

	it("keeps the 1RM estimate and the 1RM planning rule in separate questions", () => {
		const { oneRm, oneRmPlanning } = MESSAGES.en.support.faq.items;
		expect(oneRm.q).toMatch(/estimate/i);
		expect(oneRm.a).not.toMatch(/percentage|plan/i);
		expect(oneRmPlanning.q).toMatch(/plan/i);
		expect(oneRmPlanning.a).toMatch(/logged single/);
	});
});

describe("public page titles", () => {
	it("translates the /support and /privacy titles", () => {
		expect(titleOf(support, rootMatch("en"))).toBe("Support — Foundry");
		expect(titleOf(support, rootMatch("nl"))).toBe("Support — Foundry");
		expect(titleOf(privacy, rootMatch("en"))).toBe(
			"Privacy statement — Foundry",
		);
		expect(titleOf(privacy, rootMatch("nl"))).toBe(
			"Privacyverklaring — Foundry",
		);
	});

	it("falls back to English when the root locale is missing or unknown", () => {
		expect(titleOf(privacy, [])).toBe("Privacy statement — Foundry");
		expect(titleOf(privacy, rootMatch("xx"))).toBe(
			"Privacy statement — Foundry",
		);
	});
});
