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
const sendPhoneCode = vi.fn();
const sendEmailCode = vi.fn();

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
			secondFactorVerification: { strategy: null },
			mfa: { verifyTOTP, sendPhoneCode, sendEmailCode },
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

function expectPending() {
	expect(screen.getByRole("status").textContent).toBe("Please wait…");
	expect(screen.queryByLabelText("Email")).toBeNull();
	expect(screen.queryByText("Verify it's you")).toBeNull();
}

/** A reload starts the page again; Clerk's server still has the attempt. */
async function reload(
	router: Awaited<ReturnType<typeof visit>>,
	change: Record<string, unknown> = {},
) {
	cleanup();
	socialAttempt(change);
	return visit(router.history.location.href);
}

function expectPlainForm() {
	expect(screen.queryByRole("status")).toBeNull();
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
		for (const [send, strategy] of [
			[sendPhoneCode, "phone_code"],
			[sendEmailCode, "email_code"],
		] as const) {
			send.mockReset().mockImplementation(async () => {
				signIn.secondFactorVerification = { strategy, status: "unverified" };
				return { error: null };
			});
		}
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
			expectPending();
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

	it("falls back from pending to the plain form without an open attempt", async () => {
		socialAttempt({ status: "needs_identifier" });
		auth.isLoaded = false;
		await visit(RESUME);
		expectPending();
		await act(async () => setLoaded(true));
		expectPlainForm();
	});

	it("shows the plain form at once without a marker", async () => {
		socialAttempt();
		auth.isLoaded = false;
		await visit("/sign-in");
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

	it.each([
		["returns an error", async () => ({ error: new Error("offline") })],
		[
			"throws",
			async () => {
				throw new Error("no client");
			},
		],
	])(
		"goes back when reset() %s, and a reload does not resume",
		async (_, fail) => {
			socialAttempt();
			reset.mockImplementation(fail);
			const router = await visit(`${RESUME}&redirect=%2Fjoin%2Ftok-1`);
			await click("Back to sign in");
			await vi.waitFor(() =>
				expect(router.history.location.href).toBe(
					"/sign-in?redirect=%2Fjoin%2Ftok-1",
				),
			);
			expectPlainForm();
			await reload(router);
			expectPlainForm();
		},
	);

	it("does not resume after going back and reloading", async () => {
		socialAttempt();
		const router = await visit(RESUME);
		await click("Back to sign in");
		await vi.waitFor(() =>
			expect(router.history.location.href).toBe("/sign-in"),
		);
		await reload(router);
		expectPlainForm();
	});

	it("leaves the URL alone when going back without a marker", async () => {
		socialAttempt({
			status: "needs_identifier",
			password: async () => {
				signIn.status = "needs_second_factor";
				return { error: null };
			},
		});
		const router = await visit("/sign-in");
		const navigate = vi.spyOn(router, "navigate");
		await click("Sign in");
		expect(screen.getByText("Verify it's you")).toBeDefined();
		await click("Back to sign in");
		expectPlainForm();
		expect(document.activeElement).toBe(screen.getByLabelText("Email"));
		expect(navigate).not.toHaveBeenCalled();
	});

	it.each([
		["phone_code", sendPhoneCode],
		["email_code", sendEmailCode],
	])(
		"sends a %s once across a reload, then only on request",
		async (strategy, send) => {
			const supportedSecondFactors = [{ strategy }];
			socialAttempt({ supportedSecondFactors });
			const router = await visit(RESUME);
			expect(send).toHaveBeenCalledTimes(1);
			const { secondFactorVerification } = signIn;
			await reload(router, {
				supportedSecondFactors,
				secondFactorVerification,
			});
			expect(screen.getByText("Verify it's you")).toBeDefined();
			expect(send).toHaveBeenCalledTimes(1);
			await click("Send a new code");
			expect(send).toHaveBeenCalledTimes(2);
		},
	);

	it("sends on reload when the first send failed", async () => {
		const supportedSecondFactors = [{ strategy: "phone_code" }];
		socialAttempt({ supportedSecondFactors });
		sendPhoneCode.mockResolvedValueOnce({ error: new Error("offline") });
		const router = await visit(RESUME);
		const { secondFactorVerification } = signIn;
		await reload(router, { supportedSecondFactors, secondFactorVerification });
		expect(sendPhoneCode).toHaveBeenCalledTimes(2);
	});

	it("reopens on the method the code was sent for, not the default", async () => {
		const supportedSecondFactors = [
			{ strategy: "phone_code" },
			{ strategy: "email_code", safeIdentifier: "a***@b.com" },
		];
		socialAttempt({ supportedSecondFactors });
		const router = await visit(RESUME);
		await click("Email a code to a***@b.com");
		const { secondFactorVerification } = signIn;
		await reload(router, { supportedSecondFactors, secondFactorVerification });
		expect(
			screen.getByText("We sent a 6-digit code to a***@b.com."),
		).toBeDefined();
		expect(sendPhoneCode).toHaveBeenCalledTimes(1);
		expect(sendEmailCode).toHaveBeenCalledTimes(1);
	});

	it("says the code expired on a reload, until a new one is sent", async () => {
		const supportedSecondFactors = [{ strategy: "phone_code" }];
		socialAttempt({ supportedSecondFactors });
		const router = await visit(RESUME);
		await reload(router, {
			supportedSecondFactors,
			secondFactorVerification: { strategy: "phone_code", status: "expired" },
		});
		expect(
			screen.getByText(
				"The code we sent to your phone has expired. Choose “Send a new code” below.",
			),
		).toBeDefined();
		expect(sendPhoneCode).toHaveBeenCalledTimes(1);
		await click("Send a new code");
		expect(
			screen.getByText("We texted a 6-digit code to your phone."),
		).toBeDefined();
		expect(sendPhoneCode).toHaveBeenCalledTimes(2);
	});

	it("sends a code when a new password() replaces an old, expired verification", async () => {
		const password = vi.fn(async () => {
			// Clerk answers with a new attempt: nothing is prepared on it yet.
			socialAttempt({
				firstFactorVerification: { strategy: "password" },
				supportedSecondFactors: [{ strategy: "phone_code" }],
			});
			return { error: null };
		});
		socialAttempt({
			supportedSecondFactors: [{ strategy: "phone_code" }],
			secondFactorVerification: { strategy: "phone_code", status: "expired" },
			password,
		});
		await visit("/sign-in");
		expectPlainForm();
		expect(sendPhoneCode).not.toHaveBeenCalled();
		await click("Sign in");
		expect(password).toHaveBeenCalledTimes(1);
		expect(
			screen.getByText("We texted a 6-digit code to your phone."),
		).toBeDefined();
		expect(sendPhoneCode).toHaveBeenCalledTimes(1);
	});
});
