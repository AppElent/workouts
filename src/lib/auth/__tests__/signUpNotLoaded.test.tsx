// @vitest-environment jsdom
/**
 * `/sign-up` submitted before Clerk loads, in a browser where someone left a
 * social sign-up open (APP-795): the real route in a memory router. The mocked
 * `signUp` behaves like `@clerk/react`'s proxy: it reads as empty until Clerk
 * loads, and queues calls until then.
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
let queue: (() => void)[] = [];
const listeners = new Set<() => void>();
async function load() {
	await act(async () => {
		isLoaded = true;
		for (const listener of listeners) listener();
		for (const call of queue.splice(0)) call();
	});
}

const create = vi.fn();
const password = vi.fn();
const update = vi.fn();
const sendEmailCode = vi.fn();
const gate =
	(method: (params?: unknown) => Promise<unknown>) =>
	async (params?: unknown) => {
		if (!isLoaded) await new Promise<void>((resolve) => queue.push(resolve));
		return method(params);
	};
const signUp = {
	get id() {
		return isLoaded ? "sua_someone_else" : undefined;
	},
	status: "missing_requirements",
	get missingFields() {
		return isLoaded ? ["username"] : [];
	},
	unverifiedFields: [],
	create: gate(create),
	password: gate(password),
	update: gate(update),
	verifications: {
		get externalAccount() {
			return { strategy: isLoaded ? "oauth_google" : null };
		},
		sendEmailCode: gate(sendEmailCode),
	},
};

/** `useSignUp().errors`: Clerk keeps errors without a field on `global`. */
const signUpErrors: { global: unknown[] | null } = { global: null };
vi.mock("@clerk/react", async () => {
	const { useSyncExternalStore } = await import("react");
	return {
		useSignIn: () => ({ signIn: {} }),
		useSignUp: () => ({ signUp, errors: signUpErrors }),
		useAuth: () => ({
			isLoaded: useSyncExternalStore(
				(listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				() => isLoaded,
			),
		}),
	};
});

import { SESSION_STALL_MS } from "#/lib/auth/stall";
import { LocaleProvider } from "#/lib/i18n";
import { Route as SignUpRoute } from "#/routes/sign-up";

async function visit(href: string) {
	const rootRoute = createRootRoute({
		component: () => (
			<LocaleProvider initialLocale="en">
				<Outlet />
			</LocaleProvider>
		),
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([
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
}

async function wait(ms: number) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

function submitButton() {
	const button = document.querySelector<HTMLButtonElement>(
		"form button[type=submit]",
	);
	if (!button) throw new Error("no submit button");
	return button;
}

async function fillAndSubmit() {
	for (const [label, value] of [
		["Email", "a@b.com"],
		["Password", "pw12345!"],
	]) {
		fireEvent.change(screen.getByLabelText(label), { target: { value } });
	}
	// A press, and a submit that gets past the button.
	await act(async () => {
		fireEvent.click(submitButton());
		fireEvent.submit(submitButton());
	});
}

describe.each([
	{ name: "opened directly", back: false },
	{ name: "reached back from the stalled state", back: true },
])("/sign-up $name, before Clerk loads", ({ back }) => {
	beforeEach(async () => {
		isLoaded = false;
		queue = [];
		for (const mock of [create, password, update, sendEmailCode]) {
			mock.mockReset().mockResolvedValue({ error: null });
		}
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		await visit(back ? "/sign-up?resume=social" : "/sign-up");
		if (back) {
			await wait(SESSION_STALL_MS);
			await act(async () => {
				fireEvent.click(
					screen.getByRole("button", { name: "Back to sign up" }),
				);
			});
			await wait(0);
		}
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("sends and queues nothing on submit", async () => {
		expect(submitButton().disabled).toBe(true);
		expect(submitButton().textContent).toBe("Please wait…");
		await fillAndSubmit();
		expect(queue).toHaveLength(0);

		await load();
		for (const mock of [create, password, update, sendEmailCode]) {
			expect(mock).not.toHaveBeenCalled();
		}
		expect(submitButton().disabled).toBe(false);
		expect(submitButton().textContent).toBe("Create account");
	});

	it("starts a new attempt once loaded, never adding to the open one", async () => {
		await fillAndSubmit();
		await load();
		await act(async () => {
			fireEvent.click(submitButton());
		});
		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			emailAddress: "a@b.com",
			password: "pw12345!",
		});
		expect(password).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(sendEmailCode).toHaveBeenCalledTimes(1);
	});
});
