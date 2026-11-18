// @vitest-environment jsdom
/**
 * The join link survives sign-in, sign-up, password reset, and social
 * sign-in: the real auth routes run in a memory router with Clerk and Convex
 * mocked, starting from a signed-out visit to `/join/<token>`.
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

const ok = (update: Record<string, unknown> = {}, target = signIn) =>
	vi.fn(async () => {
		Object.assign(target, update);
		return { error: null };
	});

// Core 3 methods resolve to `{ error }` and update the resource in place.
const signIn: Record<string, unknown> = {};
const signUp: Record<string, unknown> = {};
const sso = vi.fn();
let callbackProps: Record<string, unknown> | null = null;

function resetClerk() {
	Object.assign(signIn, {
		status: "needs_identifier",
		supportedFirstFactors: [],
		create: ok(),
		password: ok({ status: "complete" }),
		finalize: ok(),
		sso,
		resetPasswordEmailCode: {
			sendCode: ok(),
			verifyCode: ok({ status: "needs_new_password" }),
			submitPassword: ok({ status: "complete" }),
		},
	});
	Object.assign(signUp, {
		status: "missing_requirements",
		password: ok({}, signUp),
		verifications: {
			sendEmailCode: ok({}, signUp),
			verifyEmailCode: ok({ status: "complete" }, signUp),
		},
		finalize: ok({}, signUp),
	});
	sso.mockReset().mockResolvedValue({ error: null });
	callbackProps = null;
}

vi.mock("@clerk/react", () => ({
	useSignIn: () => ({ signIn }),
	useSignUp: () => ({ signUp }),
	useAuth: () => ({ isSignedIn: false }),
	useUser: () => ({ user: null }),
	Show: ({ when, children }: { when: string; children: React.ReactNode }) =>
		when === "signed-out" ? children : null,
	AuthenticateWithRedirectCallback: (props: Record<string, unknown>) => {
		callbackProps = props;
		return null;
	},
}));

vi.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
	useMutation: () => vi.fn(),
	// The join page reads the hosted workout, then this browser's guest scores.
	useQuery: (_query: unknown, args: Record<string, unknown>) =>
		"guestKey" in args
			? []
			: {
					hosted: {
						title: "Friday WOD",
						status: "closed",
						template: { strengthBlocks: [], wodBlocks: [] },
					},
					submissions: [],
				},
}));

import { JoinHostedWorkout } from "#/components/hosted/JoinHostedWorkout";
import { LocaleProvider } from "#/lib/i18n";
import { Route as ForgotPasswordRoute } from "#/routes/forgot-password";
import { Route as SignInRoute } from "#/routes/sign-in";
import { Route as SignUpRoute } from "#/routes/sign-up";
import { Route as SsoCallbackRoute } from "#/routes/sso-callback";

const rootRoute = createRootRoute({
	component: () => (
		<LocaleProvider initialLocale="en">
			<Outlet />
		</LocaleProvider>
	),
});
const joinRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/join/$token",
	component: function JoinPage() {
		const { token } = joinRoute.useParams();
		return <JoinHostedWorkout token={token} />;
	},
});
const dashboardRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/dashboard",
	component: () => <h1>Dashboard</h1>,
});
// Mount the real auth routes the way the generated route tree does.
function mount<R extends { update: (options: never) => unknown }>(
	route: R,
	path: string,
) {
	return route.update({
		id: path,
		path,
		getParentRoute: () => rootRoute,
	} as never) as R;
}
const routeTree = rootRoute.addChildren([
	joinRoute,
	dashboardRoute,
	mount(SignInRoute, "/sign-in"),
	mount(SignUpRoute, "/sign-up"),
	mount(ForgotPasswordRoute, "/forgot-password"),
	mount(SsoCallbackRoute, "/sso-callback"),
]);

async function visit(href: string) {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [href] }),
	});
	await act(async () => {
		render(<RouterProvider router={router} />);
		await router.load();
	});
	return router;
}

type TestRouter = Awaited<ReturnType<typeof visit>>;

/** Follows a plain `<a href>` the way a full page load would. */
async function follow(router: TestRouter, name: string) {
	const href = screen.getByRole("link", { name }).getAttribute("href");
	if (!href) throw new Error(`${name} has no href`);
	await act(() => router.navigate({ href }));
	return href;
}

function type(label: string, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function click(name: string | RegExp) {
	fireEvent.click(screen.getByRole("button", { name }));
}

function signInWithEmail() {
	type("Email", "a@b.com");
	type("Password", "pw");
	click(/^sign in$/i);
}

async function signUpWithEmail() {
	type("Email", "a@b.com");
	type("Password", "pw");
	click("Create account");
	await screen.findByLabelText("Verification code");
	type("Verification code", "123456");
	click("Verify");
}

async function resetPassword() {
	type("Email", "a@b.com");
	click("Send code");
	await screen.findByLabelText("Code");
	type("Code", "123456");
	type("New password", "new-pw");
	click("Reset password");
}

async function landsOn(router: TestRouter, path: string) {
	await vi.waitFor(() => expect(router.state.location.href).toBe(path));
}

const JOIN = "/join/tok-1";
const WITH_JOIN = "?redirect=%2Fjoin%2Ftok-1";

/** From the signed-out join page to the sign-in page via "Sign in to join". */
async function startFromJoinLink() {
	const router = await visit(JOIN);
	await act(async () => {
		fireEvent.click(
			await screen.findByRole("link", { name: "Sign in to join" }),
		);
	});
	await landsOn(router, `/sign-in${WITH_JOIN}`);
	await screen.findByLabelText("Email");
	return router;
}

describe("join link through auth", () => {
	beforeEach(() => {
		resetClerk();
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_x");
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
	});

	it("returns to the join page after an email sign-in", async () => {
		const router = await startFromJoinLink();
		signInWithEmail();
		await landsOn(router, JOIN);
		expect(await screen.findByText("Friday WOD")).toBeDefined();
	});

	it("returns to the join page after signing up from sign-in", async () => {
		const router = await startFromJoinLink();
		expect(await follow(router, "Create an account")).toBe(
			`/sign-up${WITH_JOIN}`,
		);
		await signUpWithEmail();
		await landsOn(router, JOIN);
	});

	it("returns to the join page after a password reset", async () => {
		const router = await startFromJoinLink();
		expect(await follow(router, "Forgot password?")).toBe(
			`/forgot-password${WITH_JOIN}`,
		);
		await resetPassword();
		await landsOn(router, JOIN);
	});

	it("returns to the join page after a social sign-in, even one Clerk transfers to a sign-up", async () => {
		const router = await startFromJoinLink();
		click("Continue with Google");
		await vi.waitFor(() => expect(sso).toHaveBeenCalled());
		const { redirectCallbackUrl, redirectUrl } = sso.mock.calls[0][0];
		expect(redirectUrl).toBe(JOIN);
		expect(redirectCallbackUrl).toBe(`/sso-callback${WITH_JOIN}`);

		// The provider sends the browser back to the callback URL.
		await act(() => router.navigate({ href: redirectCallbackUrl }));
		await vi.waitFor(() => expect(callbackProps).not.toBeNull());
		expect(callbackProps).toMatchObject({
			signInFallbackRedirectUrl: JOIN,
			signUpFallbackRedirectUrl: JOIN,
			signInUrl: `/sign-in${WITH_JOIN}`,
			signUpUrl: `/sign-up${WITH_JOIN}`,
		});
	});

	it("resets the password to the dashboard without a redirect", async () => {
		const router = await visit("/forgot-password");
		await screen.findByLabelText("Email");
		await resetPassword();
		await landsOn(router, "/dashboard");
	});

	it("finishes social sign-in on the dashboard without a redirect", async () => {
		await visit("/sso-callback");
		await vi.waitFor(() => expect(callbackProps).not.toBeNull());
		expect(callbackProps).toMatchObject({
			signInFallbackRedirectUrl: "/dashboard",
			signUpFallbackRedirectUrl: "/dashboard",
			signInUrl: "/sign-in",
			signUpUrl: "/sign-up",
		});
	});

	const once = (value: string) => encodeURIComponent(value);
	const twice = (value: string) => once(once(value));

	// Each entry is the raw query value, as it would appear in the address bar.
	describe.each([
		["another host", once("//evil.example/join/x")],
		["an absolute URL", once("https://evil.example/join/x")],
		["a backslash", once("/\\evil.example")],
		["a control character", once("/\t/evil.example")],
		["encoded slashes", "%2F%2Fevil.example"],
		["double-encoded slashes", twice("//evil.example")],
		["a double-encoded host", "%252F%252Fevil"],
		["a double-encoded backslash", twice("\\\\evil.example")],
		["a double-encoded absolute URL", twice("https://evil.example")],
		["a double-encoded control character", twice("\t/evil.example")],
	])("with %s as the redirect", (_, value) => {
		const query = `?redirect=${value}`;

		it("signs in to the dashboard and drops it from the links", async () => {
			const router = await visit(`/sign-in${query}`);
			await screen.findByLabelText("Email");
			expect(
				screen
					.getByRole("link", { name: "Create an account" })
					.getAttribute("href"),
			).toBe("/sign-up");
			expect(
				screen
					.getByRole("link", { name: "Forgot password?" })
					.getAttribute("href"),
			).toBe("/forgot-password");
			click("Continue with Google");
			await vi.waitFor(() =>
				expect(sso).toHaveBeenCalledWith(
					expect.objectContaining({
						redirectCallbackUrl: "/sso-callback",
						redirectUrl: "/dashboard",
					}),
				),
			);
			signInWithEmail();
			await landsOn(router, "/dashboard");
		});

		it("signs up to the dashboard", async () => {
			const router = await visit(`/sign-up${query}`);
			await screen.findByLabelText("Email");
			await signUpWithEmail();
			await landsOn(router, "/dashboard");
		});

		it("resets the password to the dashboard", async () => {
			const router = await visit(`/forgot-password${query}`);
			await screen.findByLabelText("Email");
			await resetPassword();
			await landsOn(router, "/dashboard");
		});

		it("finishes social sign-in on the dashboard", async () => {
			await visit(`/sso-callback${query}`);
			await vi.waitFor(() => expect(callbackProps).not.toBeNull());
			expect(callbackProps).toMatchObject({
				signInFallbackRedirectUrl: "/dashboard",
				signUpFallbackRedirectUrl: "/dashboard",
				signInUrl: "/sign-in",
				signUpUrl: "/sign-up",
			});
		});
	});

	// `safeRedirect` keeps these: they start with one `/` and hold only
	// percent-escapes, so the browser reads them as paths on this site.
	describe.each([
		["an encoded slash", `%2F${twice("/")}%2Fevil.example`],
		["an encoded backslash", `%2F${twice("\\")}evil.example`],
		["an encoded control character", `%2F${twice("\t")}%2Fevil.example`],
	])("with %s inside a same-site path", (_, value) => {
		const query = `?redirect=${value}`;
		const sameSite = (href: unknown) =>
			new URL(String(href), "https://foundry.test").origin ===
			"https://foundry.test";

		it("signs in to a path on this site", async () => {
			const router = await visit(`/sign-in${query}`);
			await screen.findByLabelText("Email");
			signInWithEmail();
			await vi.waitFor(() =>
				expect(router.state.location.pathname).not.toBe("/sign-in"),
			);
			expect(router.state.location.href).toMatch(/^\/(?![/\\])/);
			expect(sameSite(router.state.location.href)).toBe(true);
		});

		it("finishes social sign-in on a path on this site", async () => {
			await visit(`/sso-callback${query}`);
			await vi.waitFor(() => expect(callbackProps).not.toBeNull());
			const props = callbackProps as Record<string, unknown>;
			for (const key of [
				"signInFallbackRedirectUrl",
				"signUpFallbackRedirectUrl",
				"signInUrl",
				"signUpUrl",
			]) {
				expect(String(props[key])).toMatch(/^\/(?![/\\])/);
				expect(sameSite(props[key])).toBe(true);
			}
		});
	});
});
