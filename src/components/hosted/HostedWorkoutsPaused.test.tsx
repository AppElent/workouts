/**
 * Hosted Workouts are parked (APP-437): with HOSTED_WORKOUTS_ENABLED off, the
 * nav drops the item and every hosted route and join link shows the paused
 * state instead of the feature.
 */

import { HOSTED_WORKOUTS_ENABLED } from "@foundry/core/features";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HostedWorkoutsPaused } from "#/components/hosted/HostedWorkoutsPaused";
import { useNavItems } from "#/components/navItems";
import { LocaleProvider } from "#/lib/i18n";
import { Route as HostedIdRoute } from "#/routes/_app/_authed/hosted-workouts/$id";
import { Route as HostedEditRoute } from "#/routes/_app/_authed/hosted-workouts/edit.$id";
import { Route as HostedListRoute } from "#/routes/_app/_authed/hosted-workouts/index";
import { Route as HostedNewRoute } from "#/routes/_app/_authed/hosted-workouts/new";
import { Route as JoinRoute } from "#/routes/_app/join/$token";

const auth = vi.hoisted(() => ({ isSignedIn: false }));
vi.mock("@clerk/react", () => ({ useAuth: () => auth }));

afterEach(cleanup);

function NavLabels() {
	return (
		<ul>
			{useNavItems().map((item) => (
				<li key={item.key}>{item.label}</li>
			))}
		</ul>
	);
}

async function visit(component: () => React.ReactNode) {
	const rootRoute = createRootRoute({
		component: () => (
			<LocaleProvider initialLocale="en">
				<Outlet />
			</LocaleProvider>
		),
	});
	const page = createRoute({
		getParentRoute: () => rootRoute,
		path: "/page",
		component,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([page]),
		history: createMemoryHistory({ initialEntries: ["/page"] }),
	});
	await act(async () => {
		render(<RouterProvider router={router} />);
		await router.load();
	});
}

it("is switched off", () => {
	expect(HOSTED_WORKOUTS_ENABLED).toBe(false);
});

it.each([
	["hosted list", HostedListRoute],
	["host new", HostedNewRoute],
	["host console", HostedIdRoute],
	["host edit", HostedEditRoute],
	["join link", JoinRoute],
])("shows the paused state on the %s route", (_name, route) => {
	expect(route.options.component).toBe(HostedWorkoutsPaused);
});

describe("paused state", () => {
	it("sends a signed-out visitor to the landing page", async () => {
		auth.isSignedIn = false;
		await visit(HostedWorkoutsPaused);
		expect(screen.getByText("Hosted Workouts are paused")).toBeTruthy();
		expect(
			screen
				.getByRole("button", { name: "Go to Foundry" })
				.getAttribute("href"),
		).toBe("/");
	});

	it("sends a signed-in person to their dashboard", async () => {
		auth.isSignedIn = true;
		await visit(HostedWorkoutsPaused);
		expect(
			screen
				.getByRole("button", { name: "Go to Foundry" })
				.getAttribute("href"),
		).toBe("/dashboard");
	});
});

it("leaves Host Workout out of the nav", async () => {
	auth.isSignedIn = true;
	await visit(NavLabels);
	expect(screen.getByText("WODs")).toBeTruthy();
	expect(screen.queryByText("Host Workout")).toBeNull();
});
