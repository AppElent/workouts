// @vitest-environment jsdom
import { enUS, nlNL } from "@clerk/localizations";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider, useI18n } from "#/lib/i18n";
import AppClerkProvider from "../provider";

const clerkProps = vi.fn();
vi.mock("@clerk/react", () => ({
	ClerkProvider: (props: { localization?: unknown; children: unknown }) => {
		clerkProps(props);
		return props.children;
	},
}));
vi.mock("#/lib/observability/user", () => ({ SentryUser: () => null }));
vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_placeholder");

let switchLocale: (locale: "en" | "nl") => void = () => {};
function LocaleSwitch() {
	switchLocale = useI18n().setLocale;
	return null;
}

function lastLocalization() {
	return clerkProps.mock.lastCall?.[0].localization;
}

afterEach(() => {
	cleanup();
	clerkProps.mockClear();
});

describe("AppClerkProvider", () => {
	it("gives Clerk Dutch strings on a Dutch page", () => {
		render(
			<LocaleProvider initialLocale="nl">
				<AppClerkProvider>{null}</AppClerkProvider>
			</LocaleProvider>,
		);
		expect(lastLocalization()).toBe(nlNL);
	});

	it("follows a language switch, back to English too", () => {
		render(
			<LocaleProvider initialLocale="en">
				<AppClerkProvider>
					<LocaleSwitch />
				</AppClerkProvider>
			</LocaleProvider>,
		);
		expect(lastLocalization()).toBe(enUS);
		act(() => switchLocale("nl"));
		expect(lastLocalization()).toBe(nlNL);
		act(() => switchLocale("en"));
		expect(lastLocalization()).toBe(enUS);
	});
});
