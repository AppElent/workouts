// @vitest-environment jsdom
/**
 * A social sign-in or sign-up whose resume or callback waits on a Clerk that
 * never loads (APP-772, APP-796): the real routes in a memory router with Clerk mocked.
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

const signIn: Record<string, unknown> = {
	status: "needs_second_factor",
	supportedFirstFactors: [],
	supportedSecondFactors: [{ strategy: "totp" }],
	firstFactorVerification: { strategy: "oauth_google" },
	secondFactorVerification: { strategy: null },
};
const signUp: Record<string, unknown> = {
	id: "sua_1",
	status: "missing_requirements",
	emailAddress: null,
	missingFields: ["username"],
	unverifiedFields: [],
	verifications: {
		externalAccount: { status: "verified", strategy: "oauth_google" },
	},
};

vi.mock("@clerk/react", async () => {
	const { useSyncExternalStore } = await import("react");
	return {
		// Like Clerk's: mounts, and so handles the callback, only once loaded.
		AuthenticateWithRedirectCallback: () =>
			isLoaded ? <p>Clerk callback</p> : null,
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
import { Route as SsoCallbackRoute } from "#/routes/sso-callback";

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
			SsoCallbackRoute.update({
				id: "/sso-callback",
				path: "/sso-callback",
				getParentRoute: () => rootRoute,
			} as never),
		]),
		history: createMemoryHistory({
			initialEntries: ["/before", href],
		}),
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
		resumedField: "Code",
		submit: "Sign in",
		attempt: signIn,
	},
	{
		path: "/sign-up",
		back: "Back to sign up",
		backNl: "Terug naar aanmelden",
		resumed: "One more step",
		resumedField: "Username",
		submit: "Create account",
		attempt: signUp,
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
			"This is taking longer than usual",
		);
		expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
		expect(screen.getByRole("button", { name: page.back }).className).toContain(
			"min-h-11",
		);
	});

	it("shows the error in Dutch", async () => {
		await visit(resume, "nl");
		await wait(SESSION_STALL_MS);
		expect(screen.getByRole("alert").textContent).toBe(
			"Dit duurt langer dan normaal",
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
		expect(document.activeElement).toBe(screen.getByLabelText("Email"));
		expect(
			screen.getAllByRole("button", { name: "Please wait…" }),
		).toHaveLength(1);
		expect(screen.queryByRole("button", { name: page.submit })).toBeNull();
		expectNoError();

		// Clerk loading late must not pull the person back into the attempt.
		await act(async () => setLoaded());
		await wait(SESSION_STALL_MS);
		expect(screen.getByLabelText("Email")).toBeDefined();
		expect(screen.queryByText(page.resumed)).toBeNull();
		expect(screen.getByRole("button", { name: page.submit })).toBeDefined();
		expectNoError();
	});

	it("replaces the history entry on going back", async () => {
		const router = await visit(resume);
		expect(router.history.length).toBe(2);
		await wait(SESSION_STALL_MS);
		await click(page.back);
		await wait(0);
		expect(router.history.length).toBe(2);
		await act(async () => router.history.back());
		expect(router.history.location.href).toBe("/before");
	});

	it("shows the plain form when Clerk loads in time without an open attempt", async () => {
		const { status } = page.attempt;
		page.attempt.status = null;
		try {
			await visit(resume);
			await wait(SESSION_STALL_MS - 1);
			await act(async () => setLoaded());
			expect(document.activeElement).toBe(screen.getByLabelText("Email"));
			expect(screen.getByRole("button", { name: page.submit })).toBeDefined();
			expect(screen.queryByText(page.resumed)).toBeNull();
			await wait(SESSION_STALL_MS);
			expectNoError();
		} finally {
			page.attempt.status = status;
		}
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
		expect(document.activeElement).toBe(
			screen.getByLabelText(page.resumedField),
		);
		expectNoError();
	});

	it("leaves the plain URL alone", async () => {
		await visit(page.path);
		await wait(SESSION_STALL_MS);
		expect(screen.getByLabelText("Email")).not.toBe(document.activeElement);
		expectNoError();
	});
});

describe("/sso-callback while Clerk does not load", () => {
	const callback = `/sso-callback?${REDIRECT}`;

	beforeEach(() => {
		isLoaded = false;
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("shows the stalled error after the timeout, with a retry", async () => {
		const router = await visit(callback);
		await wait(SESSION_STALL_MS - 1);
		expect(screen.getByRole("status").textContent).toBe("Please wait…");
		expectNoError();

		await wait(1);
		expect(screen.getByRole("alert").textContent).toBe(
			"This is taking longer than usual",
		);
		const reload = vi.fn();
		vi.stubGlobal("location", { ...window.location, reload });
		await click("Try again");
		expect(reload).toHaveBeenCalledTimes(1);
		expect(router.history.location.href).toBe(callback);
	});

	it("shows it in Dutch", async () => {
		await visit(callback, "nl");
		await wait(SESSION_STALL_MS);
		expect(screen.getByRole("alert").textContent).toBe(
			"Dit duurt langer dan normaal",
		);
		expect(
			screen.getByRole("button", { name: "Terug naar inloggen" }),
		).toBeDefined();
	});

	it("goes back to sign-in in place, and stays there if Clerk loads late", async () => {
		const router = await visit(callback);
		await wait(SESSION_STALL_MS);
		await click("Back to sign in");
		await wait(0);
		expect(router.history.location.href).toBe(`/sign-in?${REDIRECT}`);
		expect(router.history.length).toBe(2);
		expect(document.activeElement).toBe(screen.getByLabelText("Email"));

		await act(async () => setLoaded());
		expect(screen.queryByText("Clerk callback")).toBeNull();
		expect(screen.queryByText("Verify it's you")).toBeNull();
		expect(screen.getByLabelText("Email")).toBeDefined();
	});

	it.each([
		["in time", SESSION_STALL_MS - 1],
		["after the error", SESSION_STALL_MS],
	])("carries on when Clerk loads %s", async (_, ms) => {
		await visit(callback);
		await wait(ms);
		await act(async () => setLoaded());
		expect(screen.getByText("Clerk callback")).toBeDefined();
		await wait(SESSION_STALL_MS);
		expectNoError();
	});
});
