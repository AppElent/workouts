// @vitest-environment jsdom
/**
 * A social sign-in or sign-up whose resume waits on a Clerk that never loads
 * (APP-772): the real routes in a memory router with Clerk mocked.
 */

import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let isLoaded = false;
const listeners = new Set<() => void>();
function setLoaded() {
	isLoaded = true;
	for (const listener of listeners) listener();
}

const signIn = {
	status: "needs_second_factor",
	supportedFirstFactors: [],
	supportedSecondFactors: [{ strategy: "totp" }],
	firstFactorVerification: { strategy: "oauth_google" },
	secondFactorVerification: { strategy: null },
};
const signUp = {
	id: "sua_1",
	status: "missing_requirements",
	missingFields: ["username"],
	unverifiedFields: [],
	verifications: {
		externalAccount: { status: "verified", strategy: "oauth_google" },
	},
};

vi.mock("@clerk/react", async () => {
	const { useSyncExternalStore } = await import("react");
	return {
		useSignIn: () => ({ signIn }),
		useSignUp: () => ({ signUp }),
		useAuth: () => ({
			isLoaded: useSyncExternalStore(
				(listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				() => isLoaded,
			),
			isSignedIn: false,
		}),
	};
});

import { SESSION_STALL_MS } from "#/lib/auth/stall";
import { LocaleProvider } from "#/lib/i18n";
import { Route as SignInRoute } from "#/routes/sign-in";
import { Route as SignUpRoute } from "#/routes/sign-up";

async function visit(href: string, locale: "en" | "nl" = "en") {
	const rootRoute = createRootRoute({
		component: () => (
			<LocaleProvider initialLocale={locale}>
				<Outlet />
			</LocaleProvider>
		),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			SignInRoute.update({
				id: "/sign-in",
				path: "/sign-in",
				getParentRoute: () => rootRoute,
			} as never),
			SignUpRoute.update({
				id: "/sign-up",
				path: "/sign-up",
				getParentRoute: () => rootRoute,
			} as never),
		]),
		history: createMemoryHistory({ initialEntries: [href] }),
	});
	await act(async () => {
		render(<RouterProvider router={router} />);
		await router.load();
	});
	return router;
}

async function wait(ms: number) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

async function click(name: string) {
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name }));
	});
}

function expectNoError() {
	expect(screen.queryByRole("alert")).toBeNull();
	expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
}

const REDIRECT = "redirect=%2Fjoin%2Ftok-1";

describe.each([
	{
		path: "/sign-in",
		back: "Back to sign in",
		backNl: "Terug naar inloggen",
		resumed: "Verify it's you",
		submit: "Sign in",
	},
	{
		path: "/sign-up",
		back: "Start over",
		backNl: "Opnieuw beginnen",
		resumed: "One more step",
		submit: "Create account",
	},
])("$path resuming while Clerk does not load", (page) => {
	const resume = `${page.path}?${REDIRECT}&resume=social`;
	const reload = vi.fn();

	beforeEach(() => {
		isLoaded = false;
		reload.mockReset();
		vi.useFakeTimers({
			toFake: ["setTimeout", "clearTimeout"],
		});
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("replaces the pending state with an error after the timeout", async () => {
		await visit(resume);
		await wait(SESSION_STALL_MS - 1);
		expect(screen.getByRole("status").textContent).toBe("Please wait…");
		expectNoError();

		await wait(1);
		expect(screen.queryByRole("status")).toBeNull();
		expect(screen.getByRole("alert").textContent).toBe(
			"Can't reach the server. Check your connection.",
		);
		expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
		expect(screen.getByRole("button", { name: page.back })).toBeDefined();
	});

	it("shows the error in Dutch", async () => {
		await visit(resume, "nl");
		await wait(SESSION_STALL_MS);
		expect(screen.getByRole("alert").textContent).toBe(
			"De server is niet bereikbaar. Controleer je verbinding.",
		);
		expect(
			screen.getByRole("button", { name: "Opnieuw proberen" }),
		).toBeDefined();
		expect(screen.getByRole("button", { name: page.backNl })).toBeDefined();
	});

	it("reloads on retry with the marker still in the URL", async () => {
		const router = await visit(resume);
		await wait(SESSION_STALL_MS);
		vi.stubGlobal("location", { ...window.location, reload });
		await click("Try again");
		expect(reload).toHaveBeenCalledTimes(1);
		expect(router.history.location.href).toBe(resume);
	});

	it("goes back to the plain form without the marker, and stays there", async () => {
		const router = await visit(resume);
		await wait(SESSION_STALL_MS);
		await click(page.back);
		await wait(0);
		expect(router.history.location.href).toBe(`${page.path}?${REDIRECT}`);
		expect(screen.getByLabelText("Email")).toBeDefined();
		expect(screen.getByRole("button", { name: page.submit })).toBeDefined();
		expectNoError();

		// Clerk loading late must not pull the person back into the attempt.
		await act(async () => setLoaded());
		await wait(SESSION_STALL_MS);
		expect(screen.getByLabelText("Email")).toBeDefined();
		expect(screen.queryByText(page.resumed)).toBeNull();
		expectNoError();
	});

	it("shows no error when Clerk loads in time", async () => {
		await visit(resume);
		await wait(SESSION_STALL_MS - 1);
		await act(async () => setLoaded());
		expect(screen.getByText(page.resumed)).toBeDefined();
		await wait(SESSION_STALL_MS);
		expect(screen.getByText(page.resumed)).toBeDefined();
		expectNoError();
	});

	it("carries on when Clerk loads after the error", async () => {
		await visit(resume);
		await wait(SESSION_STALL_MS);
		await act(async () => setLoaded());
		expect(screen.getByText(page.resumed)).toBeDefined();
		expectNoError();
	});

	it("leaves the plain URL alone", async () => {
		await visit(page.path);
		await wait(SESSION_STALL_MS);
		expect(screen.getByLabelText("Email")).toBeDefined();
		expectNoError();
	});
});
