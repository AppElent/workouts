// @vitest-environment jsdom
/**
 * Signed-in pages wait for Convex to confirm the session, and a session that
 * ends goes to sign-in with a way back instead of the error card (APP-190).
 * The real `_authed` layout and route error fallback run in a memory router
 * with Clerk and Convex auth mocked as a store the test drives.
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
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AuthSnapshot = {
	clerk: { isLoaded: boolean; isSignedIn: boolean | undefined };
	convex: { isLoading: boolean; isAuthenticated: boolean };
};

const listeners = new Set<() => void>();
let snapshot: AuthSnapshot;
function setAuth(next: AuthSnapshot) {
	snapshot = next;
	for (const listener of listeners) listener();
}
function useSnapshot() {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => snapshot,
	);
}

const SIGNED_OUT: AuthSnapshot = {
	clerk: { isLoaded: true, isSignedIn: false },
	convex: { isLoading: false, isAuthenticated: false },
};
const CLERK_LOADING: AuthSnapshot = {
	clerk: { isLoaded: false, isSignedIn: undefined },
	convex: { isLoading: true, isAuthenticated: false },
};
// Clerk has a session; Convex has not confirmed the token yet.
const CONVEX_PENDING: AuthSnapshot = {
	clerk: { isLoaded: true, isSignedIn: true },
	convex: { isLoading: true, isAuthenticated: false },
};
// Clerk still has a session Convex refused (ended elsewhere, not noticed yet).
const CONVEX_REFUSED: AuthSnapshot = {
	clerk: { isLoaded: true, isSignedIn: true },
	convex: { isLoading: false, isAuthenticated: false },
};
const READY: AuthSnapshot = {
	clerk: { isLoaded: true, isSignedIn: true },
	convex: { isLoading: false, isAuthenticated: true },
};

const signOut = vi.fn(async (_options?: { redirectUrl?: string }) => {});

vi.mock("@clerk/react", () => ({
	useAuth: () => useSnapshot().clerk,
	useClerk: () => ({ signOut }),
}));
vi.mock("convex/react", () => ({
	useConvexAuth: () => useSnapshot().convex,
}));

import { RouteErrorFallback } from "#/components/RouteErrorFallback";
import { sessionState } from "#/lib/auth/SessionGate";
import { SESSION_STALL_MS } from "#/lib/auth/stall";
import { LocaleProvider } from "#/lib/i18n";
import { Route as AuthedRoute } from "#/routes/_app/_authed";

class ConvexError extends Error {
	override name = "ConvexError";
	constructor(readonly data: unknown) {
		super(JSON.stringify(data));
	}
}

/** What the page's query throws on its next render, if anything. */
let queryError: Error | null = null;
const queryRuns = vi.fn();
function ProtectedPage({ title }: { title: string }) {
	queryRuns(title);
	if (queryError) throw queryError;
	return <h1>{title}</h1>;
}

const rootRoute = createRootRoute({
	component: () => (
		<LocaleProvider initialLocale="en">
			<Outlet />
		</LocaleProvider>
	),
});
const authedRoute = AuthedRoute.update({
	id: "_authed",
	getParentRoute: () => rootRoute,
} as never) as typeof AuthedRoute;
const dashboardRoute = createRoute({
	getParentRoute: () => authedRoute,
	path: "/dashboard",
	component: () => <ProtectedPage title="Dashboard" />,
});
// Outside the gate, so the error boundary alone handles a lost session.
const ungatedRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/ungated",
	component: () => <ProtectedPage title="Ungated" />,
});
const signInRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/sign-in",
	component: () => <h1>Sign in page</h1>,
});
const routeTree = rootRoute.addChildren([
	authedRoute.addChildren([dashboardRoute]),
	ungatedRoute,
	signInRoute,
]);

async function visit(href: string) {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [href] }),
		defaultErrorComponent: RouteErrorFallback,
	});
	await act(async () => {
		render(<RouterProvider router={router} />);
		await router.load();
	});
	return router;
}

async function landsOn(
	router: Awaited<ReturnType<typeof visit>>,
	href: string,
) {
	await vi.waitFor(() => expect(router.state.location.href).toBe(href));
}

beforeEach(() => {
	snapshot = READY;
	queryError = null;
	queryRuns.mockClear();
	signOut.mockClear();
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("sessionState", () => {
	it.each([
		["Clerk loading", CLERK_LOADING, "pending"],
		["signed out", SIGNED_OUT, "signedOut"],
		["Convex confirming the token", CONVEX_PENDING, "pending"],
		["Convex refused, Clerk not yet signed out", CONVEX_REFUSED, "pending"],
		["Convex confirmed", READY, "ready"],
	] as const)("%s → %s", (_, auth, expected) => {
		expect(
			sessionState({
				clerkLoaded: auth.clerk.isLoaded,
				clerkSignedIn: auth.clerk.isSignedIn === true,
				convexAuthenticated: auth.convex.isAuthenticated,
			}),
		).toBe(expected);
	});
});

describe("signed-in layout", () => {
	it("runs no protected query until Convex confirms the session (reload, deep link)", async () => {
		snapshot = CLERK_LOADING;
		await visit("/dashboard");
		expect(screen.getByRole("status").textContent).toBe(
			"Checking your sign-in…",
		);

		act(() => setAuth(CONVEX_PENDING));
		expect(screen.getByRole("status")).toBeTruthy();
		expect(queryRuns).not.toHaveBeenCalled();

		act(() => setAuth(READY));
		expect(
			await screen.findByRole("heading", { name: "Dashboard" }),
		).toBeTruthy();
		expect(screen.queryByText("Something went wrong")).toBeNull();
	});

	it("sends a signed-out visit to sign-in with the way back", async () => {
		snapshot = SIGNED_OUT;
		const router = await visit("/dashboard?tab=week");
		await landsOn(router, "/sign-in?redirect=%2Fdashboard%3Ftab%3Dweek");
		expect(queryRuns).not.toHaveBeenCalled();
	});

	it("goes to sign-in when the session ends elsewhere, not to the error card", async () => {
		const router = await visit("/dashboard");
		expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();

		// Convex refuses the refreshed token first; Clerk notices a moment later.
		act(() => setAuth(CONVEX_REFUSED));
		expect(screen.queryByRole("heading", { name: "Dashboard" })).toBeNull();
		expect(screen.getByRole("status")).toBeTruthy();

		act(() => setAuth(SIGNED_OUT));
		await landsOn(router, "/sign-in?redirect=%2Fdashboard");
		expect(screen.queryByText("Something went wrong")).toBeNull();
	});

	it("offers recovery once a session check stalls, never an endless wait", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		snapshot = CONVEX_REFUSED;
		await visit("/dashboard");
		expect(screen.queryByRole("button", { name: "Sign in again" })).toBeNull();

		act(() => vi.advanceTimersByTime(SESSION_STALL_MS));
		expect(screen.getByText("This is taking longer than usual")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
		expect(signOut).toHaveBeenCalledWith({
			redirectUrl: "/sign-in?redirect=%2Fdashboard",
		});
	});
});

describe("route error fallback", () => {
	it("turns an unauthenticated query into sign-in once the session is gone", async () => {
		queryError = new ConvexError({ code: "unauthenticated" });
		const router = await visit("/ungated");
		expect(screen.queryByText("Something went wrong")).toBeNull();
		expect(screen.queryByText("Sign in again to continue.")).toBeNull();

		act(() => setAuth(SIGNED_OUT));
		await landsOn(router, "/sign-in?redirect=%2Fungated");
	});

	it("retries an unauthenticated query once Convex confirms the session again", async () => {
		queryError = new ConvexError({ code: "unauthenticated" });
		await visit("/ungated");
		expect(screen.getByRole("status")).toBeTruthy();

		act(() => setAuth(CONVEX_PENDING));
		queryError = null;
		act(() => setAuth(READY));
		expect(
			await screen.findByRole("heading", { name: "Ungated" }),
		).toBeTruthy();
	});

	it("still shows other errors", async () => {
		queryError = new ConvexError({ code: "readOnly" });
		await visit("/ungated");
		expect(screen.getByText("Something went wrong")).toBeTruthy();
		expect(
			screen.getByText("This is built in and can't be changed."),
		).toBeTruthy();
	});
});
