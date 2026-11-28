// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render as rtlRender,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const password = vi.fn();
const sendEmailCode = vi.fn();
const verifyEmailCode = vi.fn();
const finalize = vi.fn();
// Core 3 methods resolve to `{ error }` and update the resource in place.
const signUp = {
	status: "missing_requirements",
	password,
	verifications: { sendEmailCode, verifyEmailCode },
	finalize,
};
/** `useSignUp().errors`: Clerk keeps errors without a field on `global`. */
const signUpErrors: { global: unknown[] | null } = { global: null };
vi.mock("@clerk/react", () => ({
	useSignIn: () => ({ signIn: {} }),
	useSignUp: () => ({ signUp, errors: signUpErrors }),
	useAuth: () => ({ isLoaded: true }),
}));

function ok(update: Partial<typeof signUp> = {}) {
	return async () => {
		Object.assign(signUp, update);
		return { error: null };
	};
}

import { LocaleProvider } from "#/lib/i18n";
import { SignUpForm } from "../SignUpForm";

function render(ui: React.ReactElement) {
	return rtlRender(ui, {
		wrapper: ({ children }) => (
			<LocaleProvider initialLocale="en">{children}</LocaleProvider>
		),
	});
}

function renderForm(onSuccess = vi.fn()) {
	return render(<SignUpForm onSuccess={onSuccess} />);
}

describe("SignUpForm", () => {
	afterEach(() => {
		cleanup();
		for (const m of [password, sendEmailCode, verifyEmailCode, finalize]) {
			m.mockReset();
		}
		signUp.status = "missing_requirements";
	});

	beforeEach(() => {
		password.mockImplementation(ok());
		sendEmailCode.mockImplementation(ok());
		finalize.mockImplementation(ok());
	});

	it("moves to the verification step after creating the account", async () => {
		renderForm();
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "pw12345!" },
		});
		fireEvent.click(screen.getByRole("button", { name: /create account/i }));
		expect(await screen.findByLabelText(/verification code/i)).toBeDefined();
		expect(password).toHaveBeenCalledWith({
			emailAddress: "a@b.com",
			password: "pw12345!",
		});
		expect(sendEmailCode).toHaveBeenCalled();
	});

	it("marks the credential fields for password managers", () => {
		renderForm();
		expect(screen.getByLabelText("Email").getAttribute("autocomplete")).toBe(
			"username",
		);
		expect(screen.getByLabelText("Password").getAttribute("autocomplete")).toBe(
			"new-password",
		);
	});

	function fillAndSubmit() {
		fireEvent.change(screen.getByLabelText(/^(Email|E-mail)$/), {
			target: { value: "a@b.com" },
		});
		fireEvent.change(screen.getByLabelText(/^(Password|Wachtwoord)$/), {
			target: { value: "pw12345!" },
		});
		fireEvent.submit(
			screen.getByRole("button", { name: /create account|account aanmaken/i }),
		);
	}

	const BOT_CHECK_FAILED =
		"We couldn't confirm you're not a bot. Please try again, or turn off a VPN or proxy.";
	/** What Clerk returns when its bot challenge expires before it is passed. */
	const timedOut = {
		code: "protect_check_timed_out",
		message: "The challenge timed out.",
	};

	it("mounts no CAPTCHA element: Clerk shows its challenge in a dialog", () => {
		renderForm();
		expect(document.querySelector("#clerk-captcha")).toBeNull();
	});

	it("explains a failed bot challenge, and the retry goes through", async () => {
		password.mockImplementationOnce(async () => ({ error: timedOut }));
		renderForm();
		fillAndSubmit();
		expect((await screen.findByRole("alert")).textContent).toBe(
			BOT_CHECK_FAILED,
		);
		expect(sendEmailCode).not.toHaveBeenCalled();

		fillAndSubmit();
		expect(await screen.findByLabelText(/verification code/i)).toBeDefined();
		expect(password).toHaveBeenCalledTimes(2);
		expect(sendEmailCode).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("explains a failed bot challenge in Dutch when the app is in Dutch", async () => {
		password.mockImplementationOnce(async () => ({ error: timedOut }));
		rtlRender(<SignUpForm onSuccess={vi.fn()} />, {
			wrapper: ({ children }) => (
				<LocaleProvider initialLocale="nl">{children}</LocaleProvider>
			),
		});
		fillAndSubmit();
		expect((await screen.findByRole("alert")).textContent).toBe(
			"We konden niet bevestigen dat je geen bot bent. Probeer het opnieuw, of zet een vpn of proxy uit.",
		);
	});

	it.each([
		["an attempt it cannot resume", {}],
		// The challenge sits on the transferred social sign-up, which otherwise
		// looks like one the continue step could finish.
		[
			"a social attempt it could otherwise resume",
			{ id: "sua_1", externalAccount: { strategy: "oauth_google" } },
		],
	])(
		"explains a social sign-up that failed the bot challenge on the way back, with %s",
		async (_, attempt) => {
			const { id, externalAccount } = attempt as {
				id?: string;
				externalAccount?: { strategy: string };
			};
			Object.assign(signUp, { id });
			Object.assign(signUp.verifications, { externalAccount });
			signUpErrors.global = [timedOut];
			try {
				render(<SignUpForm onSuccess={vi.fn()} resumeSocial />);
				expect((await screen.findByRole("alert")).textContent).toBe(
					BOT_CHECK_FAILED,
				);
				expect(screen.getByLabelText("Email")).toBeDefined();
			} finally {
				signUpErrors.global = null;
				Object.assign(signUp, { id: undefined });
				Object.assign(signUp.verifications, { externalAccount: undefined });
			}
		},
	);

	it("shows no error when a social sign-up comes back without one", async () => {
		render(<SignUpForm onSuccess={vi.fn()} resumeSocial />);
		expect(await screen.findByLabelText("Email")).toBeDefined();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("verifies the code and completes sign-up", async () => {
		verifyEmailCode.mockImplementation(ok({ status: "complete" }));
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "pw12345!" },
		});
		fireEvent.click(screen.getByRole("button", { name: /create account/i }));
		const code = await screen.findByLabelText(/verification code/i);
		fireEvent.change(code, { target: { value: "123456" } });
		fireEvent.click(screen.getByRole("button", { name: /verify/i }));
		await vi.waitFor(() => expect(finalize).toHaveBeenCalled());
		expect(verifyEmailCode).toHaveBeenCalledWith({ code: "123456" });
		expect(onSuccess).toHaveBeenCalled();
	});
});
