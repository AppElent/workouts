// @vitest-environment jsdom
/**
 * A social sign-in that still needs a second factor: the real `/sign-in` route
 * in a memory router with Clerk mocked.
 */

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
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

// Core 3 methods resolve to `{ error }` and update the resource in place.
const signIn: Record<string, unknown> = {};
const auth = { isLoaded: true, isSignedIn: false };
const verifyTOTP = vi.fn();
const finalize = vi.fn();
const reset = vi.fn();

// Clerk loads after the router has rewritten the URL, so `useAuth` re-renders.
const listeners = new Set<() => void>();
function setLoaded(isLoaded: boolean) {
	auth.isLoaded = isLoaded;
	for (const listener of listeners) listener();
}

vi.mock("@clerk/react", async () => {
	const { useSyncExternalStore } = await import("react");
	return {
		useSignIn: () => ({ signIn }),
		useAuth: () => {
			const isLoaded = useSyncExternalStore(
				(listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				() => auth.isLoaded,
			);
			return { ...auth, isLoaded };
		},
	};
});

import { LocaleProvider } from "#/lib/i18n";
import { Route as SignInRoute } from "#/routes/sign-in";

/** What Clerk holds after a Google sign-in on an account with MFA. */
function socialAttempt(change: Record<string, unknown> = {}) {
	Object.assign(
		signIn,
		{
			status: "needs_second_factor",
			supportedFirstFactors: [],
			supportedSecondFactors: [{ strategy: "totp" }],
			firstFactorVerification: { strategy: "oauth_google" },
			mfa: { verifyTOTP },
			finalize,
			reset,
		},
		change,
	);
}

async function visit(href: string) {
	const rootRoute = createRootRoute({
		component: () => (
			<LocaleProvider initialLocale="en">
				<Outlet />
			</LocaleProvider>
		),
	});
	const page = (path: string) =>
		createRoute({
			getParentRoute: () => rootRoute,
			path,
			component: () => <h1>{path}</h1>,
		});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			page("/dashboard"),
			page("/join/tok-1"),
			SignInRoute.update({
				id: "/sign-in",
				path: "/sign-in",
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

const RESUME = "/sign-in?resume=social";

async function click(name: string) {
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name }));
	});
}

function expectPlainForm() {
	expect(screen.getByLabelText("Email")).toBeDefined();
	expect(screen.getByLabelText("Password")).toBeDefined();
	expect(screen.queryByText("Verify it's you")).toBeNull();
}

describe("/sign-in resuming a social sign-in", () => {
	beforeEach(() => {
		auth.isLoaded = true;
		verifyTOTP.mockReset().mockImplementation(async () => {
			signIn.status = "complete";
			return { error: null };
		});
		finalize.mockReset().mockResolvedValue({ error: null });
		reset.mockReset().mockImplementation(async () => {
			signIn.status = "needs_identifier";
			return { error: null };
		});
	});

	afterEach(cleanup);

	it.each([[RESUME], ["/sign-in?redirect=%2Fjoin%2Ftok-1&resume=social"]])(
		"keeps the marker in the URL at %s",
		async (href) => {
			socialAttempt();
			const router = await visit(href);
			// The router rewrites the URL from the validated search.
			expect(router.state.location.href).toBe(href);
			expect(router.history.location.href).toBe(href);
		},
	);

	it.each(["needs_second_factor", "needs_client_trust"])(
		"carries on with the attempt at %s once Clerk loads, and lands on the redirect",
		async (status) => {
			// Before load, Clerk's `signIn` is a placeholder.
			socialAttempt({ status: "needs_identifier" });
			auth.isLoaded = false;
			const router = await visit(`${RESUME}&redirect=%2Fjoin%2Ftok-1`);
			expectPlainForm();
			socialAttempt({ status });
			await act(async () => setLoaded(true));
			expect(screen.getByText("Verify it's you")).toBeDefined();
			expect(screen.queryByLabelText("Password")).toBeNull();
			fireEvent.change(screen.getByLabelText("Code"), {
				target: { value: "424242" },
			});
			await click("Verify");
			expect(verifyTOTP).toHaveBeenCalledWith({ code: "424242" });
			expect(finalize).toHaveBeenCalledTimes(1);
			await vi.waitFor(() =>
				expect(router.state.location.href).toBe("/join/tok-1"),
			);
		},
	);

	it.each([
		["no marker", "/sign-in", {}],
		["another marker", "/sign-in?resume=1", {}],
		["a boolean marker", "/sign-in?resume=true", {}],
		["no open attempt", RESUME, { status: "needs_identifier" }],
		[
			"a password attempt",
			RESUME,
			{ firstFactorVerification: { strategy: "password" } },
		],
	])("shows the plain form with %s", async (_, href, change) => {
		socialAttempt(change);
		await visit(href);
		expectPlainForm();
	});

	it("leaves the plain URL alone", async () => {
		socialAttempt();
		const router = await visit("/sign-in?redirect=%2Fjoin%2Ftok-1");
		expect(router.state.location.href).toBe(
			"/sign-in?redirect=%2Fjoin%2Ftok-1",
		);
	});

	it("goes back to the plain form, without the marker but with the redirect", async () => {
		socialAttempt();
		const router = await visit(`${RESUME}&redirect=%2Fjoin%2Ftok-1`);
		await click("Back to sign in");
		expect(reset).toHaveBeenCalledTimes(1);
		await vi.waitFor(() =>
			expect(router.state.location.href).toBe(
				"/sign-in?redirect=%2Fjoin%2Ftok-1",
			),
		);
		expectPlainForm();
	});
});
