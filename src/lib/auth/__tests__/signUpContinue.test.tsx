// @vitest-environment jsdom
/**
 * The continue step of a social sign-up: the real `/sign-up` route in a memory
 * router with Clerk mocked.
 */

import { ClerkAPIResponseError } from "@clerk/react/errors";
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
const signUp: Record<string, unknown> = {};
const auth = { isLoaded: true };

type Result = { error: unknown };
const ok = (change: Record<string, unknown> = {}) =>
	vi.fn(async (_params?: unknown): Promise<Result> => {
		Object.assign(signUp, change);
		return { error: null };
	});
const fails = (code: string, paramName?: string) =>
	vi.fn(
		async (_params?: unknown): Promise<Result> => ({
			error: new ClerkAPIResponseError("failed", {
				data: [
					{
						code,
						message: "English text from Clerk",
						meta: paramName ? { param_name: paramName } : undefined,
					},
				],
				status: 422,
			}),
		}),
	);

const update = { current: ok() };
const finalize = vi.fn();
const reset = vi.fn();
const password = vi.fn();
const create = vi.fn();
const sendEmailCode = vi.fn();
const verifyEmailCode = { current: ok() };
const sendPhoneCode = vi.fn();
const verifyPhoneCode = { current: ok() };

/** `useSignUp().errors`: Clerk keeps errors without a field on `global`. */
const signUpErrors: { global: unknown[] | null } = { global: null };
vi.mock("@clerk/react", () => ({
	useSignIn: () => ({ signIn: {} }),
	useSignUp: () => ({ signUp, errors: signUpErrors }),
	useAuth: () => auth,
}));

import { LocaleProvider } from "#/lib/i18n";
import { Route as SignUpRoute } from "#/routes/sign-up";

/** What Clerk holds after a Google account was transferred to a sign-up. */
function socialAttempt(change: Record<string, unknown> = {}) {
	Object.assign(
		signUp,
		{
			id: "sua_1",
			status: "missing_requirements",
			missingFields: [],
			unverifiedFields: [],
			emailAddress: null,
			phoneNumber: null,
			update: (params: unknown) => update.current(params),
			finalize,
			reset,
			password,
			create,
			verifications: {
				externalAccount: { status: "verified", strategy: "oauth_google" },
				sendEmailCode,
				verifyEmailCode: (params: unknown) => verifyEmailCode.current(params),
				sendPhoneCode,
				verifyPhoneCode: (params: unknown) => verifyPhoneCode.current(params),
			},
		},
		change,
	);
}

async function visit(href: string, locale: "en" | "nl" = "en") {
	const rootRoute = createRootRoute({
		component: () => (
			<LocaleProvider initialLocale={locale}>
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

const RESUME = "/sign-up?resume=social";

function type(label: string | RegExp, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function click(name: string) {
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name }));
	});
}

function inputLabels() {
	return screen
		.queryAllByRole("textbox")
		.map((input) => (input as HTMLInputElement).labels?.[0]?.textContent);
}

describe("sign-up continue step", () => {
	beforeEach(() => {
		for (const mock of [
			finalize,
			reset,
			password,
			create,
			sendEmailCode,
			sendPhoneCode,
		]) {
			mock.mockReset().mockResolvedValue({ error: null });
		}
		update.current = ok();
		verifyEmailCode.current = ok();
		verifyPhoneCode.current = ok();
		auth.isLoaded = true;
		socialAttempt();
	});
	afterEach(cleanup);

	describe("which step shows", () => {
		it("asks only for the missing fields of an attempt from the callback", async () => {
			socialAttempt({ missingFields: ["first_name", "username"] });
			const router = await visit(RESUME);
			// The router rewrites the URL from the validated search.
			expect(router.state.location.href).toBe(RESUME);
			expect(inputLabels()).toEqual(["Username", "First name"]);
			expect(screen.queryByRole("button", { name: /google/i })).toBeNull();
			// Clerk shows a bot challenge in a dialog of its own.
			expect(document.querySelector("#clerk-captcha")).toBeNull();
		});

		it("shows the plain form without the marker, whatever attempt is open", async () => {
			socialAttempt({ missingFields: ["username"] });
			await visit("/sign-up");
			expect(inputLabels()).toEqual(["Email"]);
			expect(
				screen.getByRole("button", { name: "Create account" }),
			).toBeDefined();
		});

		it.each([
			["another marker", "/sign-up?resume=1", {}],
			["no attempt", RESUME, { id: undefined }],
			["a finished attempt", RESUME, { status: "complete" }],
			["an abandoned attempt", RESUME, { status: "abandoned" }],
			[
				"an email sign-up",
				RESUME,
				{ verifications: { externalAccount: { strategy: null } } },
			],
		])("shows the plain form with %s", async (_, href, change) => {
			socialAttempt({ missingFields: ["username"], ...change });
			await visit(href);
			expect(inputLabels()).toEqual(["Email"]);
		});

		it("shows neither until Clerk has loaded", async () => {
			auth.isLoaded = false;
			socialAttempt({ missingFields: ["username"] });
			await visit(RESUME);
			expect(inputLabels()).toEqual([]);
			expect(screen.getByRole("status").textContent).toBe("Please wait…");
		});

		it("says so when Clerk wants something the form cannot ask", async () => {
			socialAttempt({ missingFields: ["username", "legal_accepted"] });
			await visit(RESUME);
			expect(screen.getByRole("alert").textContent).toMatch(
				/can't be finished here/,
			);
			expect(screen.getByRole("button", { name: "Start over" })).toBeDefined();
		});
	});

	it("sends the fields, finishes, and lands on the redirect", async () => {
		socialAttempt({ missingFields: ["username", "password"] });
		update.current = ok({ status: "complete", missingFields: [] });
		const router = await visit(`${RESUME}&redirect=%2Fjoin%2Ftok-1`);
		type("Username", " sam ");
		type("Password", "pw12345!");
		await click("Continue");
		await vi.waitFor(() =>
			expect(router.state.location.href).toBe("/join/tok-1"),
		);
		expect(update.current).toHaveBeenCalledWith({
			username: "sam",
			password: "pw12345!",
		});
		expect(finalize).toHaveBeenCalledTimes(1);
	});

	it.each([
		["no redirect", ""],
		["an unsafe redirect", "&redirect=%2F%2Fevil.example"],
	])("lands on the dashboard with %s", async (_, query) => {
		socialAttempt({ missingFields: ["username"] });
		update.current = ok({ status: "complete", missingFields: [] });
		const router = await visit(`${RESUME}${query}`);
		type("Username", "sam");
		await click("Continue");
		await vi.waitFor(() =>
			expect(router.state.location.href).toBe("/dashboard"),
		);
	});

	it("verifies an email typed here with a code", async () => {
		socialAttempt({ missingFields: ["email_address"] });
		update.current = ok({
			missingFields: [],
			unverifiedFields: ["email_address"],
			emailAddress: "a@b.com",
		});
		verifyEmailCode.current = ok({ status: "complete", unverifiedFields: [] });
		const router = await visit(RESUME);
		type("Email", "a@b.com");
		await click("Continue");
		expect(await screen.findByText(/sent a code to a@b.com/)).toBeDefined();
		expect(sendEmailCode).toHaveBeenCalledTimes(1);
		expect(finalize).not.toHaveBeenCalled();
		type("Verification code", "123456");
		await click("Verify");
		expect(verifyEmailCode.current).toHaveBeenCalledWith({ code: "123456" });
		await vi.waitFor(() =>
			expect(router.state.location.href).toBe("/dashboard"),
		);
	});

	it("sends the code at once for an email the provider left unverified", async () => {
		socialAttempt({
			unverifiedFields: ["email_address"],
			emailAddress: "a@b.com",
		});
		await visit(RESUME);
		await vi.waitFor(() => expect(sendEmailCode).toHaveBeenCalledTimes(1));
		expect(inputLabels()).toEqual(["Verification code"]);
		await click("Send a new code");
		expect(sendEmailCode).toHaveBeenCalledTimes(2);
		expect(await screen.findByText("A new code is on its way.")).toBeDefined();
	});

	it("verifies an unverified phone number by text", async () => {
		socialAttempt({
			unverifiedFields: ["phone_number"],
			phoneNumber: "+31612345678",
		});
		verifyPhoneCode.current = ok({ status: "complete", unverifiedFields: [] });
		await visit(RESUME);
		await vi.waitFor(() => expect(sendPhoneCode).toHaveBeenCalledTimes(1));
		type("Verification code", "123456");
		await click("Verify");
		expect(verifyPhoneCode.current).toHaveBeenCalledWith({ code: "123456" });
		expect(finalize).toHaveBeenCalledTimes(1);
	});

	it("retries only the last step when activating the session fails", async () => {
		socialAttempt({ missingFields: ["username"] });
		update.current = ok({ status: "complete", missingFields: [] });
		finalize.mockImplementationOnce(fails("network_error"));
		const router = await visit(RESUME);
		type("Username", "sam");
		await click("Continue");
		expect((await screen.findByRole("alert")).textContent).toMatch(
			/Can't reach the server/,
		);
		await click("Continue");
		await vi.waitFor(() =>
			expect(router.state.location.href).toBe("/dashboard"),
		);
		expect(update.current).toHaveBeenCalledTimes(1);
	});

	describe("errors", () => {
		it.each([
			["en", "Continue", "Email", /An account with this email address/],
			["nl", "Doorgaan", "E-mail", /Er bestaat al een account/],
		] as const)(
			"shows Clerk's error inline in %s and keeps the input",
			async (locale, submit, label, text) => {
				socialAttempt({ missingFields: ["email_address"] });
				update.current = fails("form_identifier_exists", "email_address");
				await visit(RESUME, locale);
				type(label, "a@b.com");
				await click(submit);
				expect((await screen.findByRole("alert")).textContent).toMatch(text);
				expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(
					"a@b.com",
				);
			},
		);

		it("does not blame the email for a taken username", async () => {
			socialAttempt({ missingFields: ["username"] });
			update.current = fails("form_identifier_exists", "username");
			await visit(RESUME);
			type("Username", "sam");
			await click("Continue");
			expect((await screen.findByRole("alert")).textContent).toMatch(
				/Another account already uses this/,
			);
		});

		it("asks for an empty field before calling Clerk", async () => {
			socialAttempt({ missingFields: ["username"] });
			await visit(RESUME);
			await click("Continue");
			expect(screen.getByRole("alert").textContent).toBe(
				"Fill in every field.",
			);
			expect(update.current).not.toHaveBeenCalled();
		});

		it("says the attempt is gone", async () => {
			socialAttempt({ missingFields: ["username"] });
			update.current = fails("resource_not_found");
			await visit(RESUME);
			type("Username", "sam");
			await click("Continue");
			expect((await screen.findByRole("alert")).textContent).toMatch(
				/took too long/,
			);
		});
	});

	it("starts over on the plain form, without the marker but with the redirect", async () => {
		socialAttempt({ missingFields: ["username"] });
		const router = await visit(`${RESUME}&redirect=%2Fjoin%2Ftok-1`);
		expect(
			screen.getByRole("link", { name: /Sign in/ }).getAttribute("href"),
		).toBe("/sign-in?redirect=%2Fjoin%2Ftok-1");
		await click("Start over");
		expect(reset).toHaveBeenCalledTimes(1);
		await vi.waitFor(() =>
			expect(router.state.location.href).toBe(
				"/sign-up?redirect=%2Fjoin%2Ftok-1",
			),
		);
		expect(inputLabels()).toEqual(["Email"]);
	});

	it("never adds an email sign-up to an abandoned social attempt", async () => {
		socialAttempt({ missingFields: ["username"] });
		await visit("/sign-up");
		type("Email", "a@b.com");
		type("Password", "pw12345!");
		await click("Create account");
		await vi.waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				emailAddress: "a@b.com",
				password: "pw12345!",
			}),
		);
		expect(password).not.toHaveBeenCalled();
	});
});
