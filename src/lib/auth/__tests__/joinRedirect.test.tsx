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

	describe.each([
		["another host", "//evil.example/join/x"],
		["an absolute URL", "https://evil.example/join/x"],
		["a backslash", "/\\evil.example"],
		["a control character", "/\t/evil.example"],
	])("with %s as the redirect", (_, unsafe) => {
		const query = `?redirect=${encodeURIComponent(unsafe)}`;

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
});
