// @vitest-environment jsdom

import { ClerkAPIResponseError } from "@clerk/react/errors";
import {
	cleanup,
	fireEvent,
	render as rtlRender,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const password = vi.fn();
const sendCode = vi.fn();
const verifyCode = vi.fn();
const finalize = vi.fn();
const reset = vi.fn();
const verifyTOTP = vi.fn();
// Core 3 methods resolve to `{ error }` and update the resource in place.
const signIn = {
	status: "needs_identifier",
	supportedFirstFactors: [] as { strategy: string }[],
	supportedSecondFactors: [] as { strategy: string }[],
	firstFactorVerification: { strategy: null as string | null },
	create,
	password,
	emailCode: { sendCode, verifyCode },
	mfa: { verifyTOTP },
	finalize,
	reset,
};
const auth = { isLoaded: true };
vi.mock("@clerk/react", () => ({
	useSignIn: () => ({ signIn }),
	useAuth: () => auth,
}));

function ok(update: Partial<typeof signIn> = {}) {
	return async () => {
		Object.assign(signIn, update);
		return { error: null };
	};
}

import { LocaleProvider } from "#/lib/i18n";
import { SignInForm } from "../SignInForm";

function render(ui: React.ReactElement) {
	return rtlRender(ui, {
		wrapper: ({ children }) => (
			<LocaleProvider initialLocale="en">{children}</LocaleProvider>
		),
	});
}

function renderForm(onSuccess = vi.fn()) {
	return render(<SignInForm onSuccess={onSuccess} />);
}

describe("SignInForm", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
		for (const m of [
			create,
			password,
			sendCode,
			verifyCode,
			finalize,
			reset,
			verifyTOTP,
		]) {
			m.mockReset();
		}
		signIn.status = "needs_identifier";
		signIn.supportedFirstFactors = [];
		signIn.supportedSecondFactors = [];
		signIn.firstFactorVerification = { strategy: null };
		auth.isLoaded = true;
	});

	beforeEach(() => {
		finalize.mockImplementation(ok());
	});

	it("submits credentials and activates the session", async () => {
		password.mockImplementation(ok({ status: "complete" }));
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "pw" },
		});
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		await vi.waitFor(() => expect(finalize).toHaveBeenCalled());
		expect(password).toHaveBeenCalledWith({
			identifier: "a@b.com",
			password: "pw",
		});
		expect(onSuccess).toHaveBeenCalled();
	});

	it("marks the credential fields for password managers", () => {
		renderForm();
		expect(screen.getByLabelText("Email").getAttribute("autocomplete")).toBe(
			"username",
		);
		expect(screen.getByLabelText("Password").getAttribute("autocomplete")).toBe(
			"current-password",
		);
	});

	it("does not activate a sign-in that stops at a step it can't complete", async () => {
		password.mockImplementation(ok({ status: "needs_first_factor" }));
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(
			await screen.findByText("Additional verification is required."),
		).toBeDefined();
		expect(finalize).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it.each(["needs_second_factor", "needs_client_trust"])(
		"asks for a second factor after the password at %s",
		async (status) => {
			password.mockImplementation(
				ok({ status, supportedSecondFactors: [{ strategy: "totp" }] }),
			);
			verifyTOTP.mockImplementation(ok({ status: "complete" }));
			const onSuccess = vi.fn();
			renderForm(onSuccess);
			fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
			expect(await screen.findByText("Verify it's you")).toBeDefined();
			expect(finalize).not.toHaveBeenCalled();
			fireEvent.change(screen.getByLabelText("Code"), {
				target: { value: "424242" },
			});
			fireEvent.click(screen.getByRole("button", { name: "Verify" }));
			await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
			expect(verifyTOTP).toHaveBeenCalledWith({ code: "424242" });
		},
	);

	it("asks for a second factor after an emailed sign-in code", async () => {
		create.mockImplementation(
			ok({ supportedFirstFactors: [{ strategy: "email_code" }] }),
		);
		sendCode.mockImplementation(ok());
		verifyCode.mockImplementation(
			ok({
				status: "needs_second_factor",
				supportedSecondFactors: [{ strategy: "totp" }],
			}),
		);
		renderForm();
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Email me a sign-in code" }),
		);
		fireEvent.change(await screen.findByLabelText("Code"), {
			target: { value: "123456" },
		});
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(await screen.findByText("Verify it's you")).toBeDefined();
		expect(finalize).not.toHaveBeenCalled();
	});

	it("goes back to a clean sign-in from the second factor", async () => {
		password.mockImplementation(
			ok({
				status: "needs_second_factor",
				supportedSecondFactors: [{ strategy: "totp" }],
			}),
		);
		reset.mockImplementation(ok({ status: "needs_identifier" }));
		renderForm();
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		fireEvent.click(
			await screen.findByRole("button", { name: "Back to sign in" }),
		);
		expect(await screen.findByLabelText("Password")).toBeDefined();
		expect(reset).toHaveBeenCalled();
	});

	it("picks up a social sign-in that came back needing a second factor", async () => {
		Object.assign(signIn, {
			status: "needs_second_factor",
			supportedSecondFactors: [{ strategy: "totp" }],
			firstFactorVerification: { strategy: "oauth_google" },
		});
		renderForm();
		expect(await screen.findByText("Verify it's you")).toBeDefined();
	});

	it("leaves an abandoned password attempt alone on arrival", () => {
		Object.assign(signIn, {
			status: "needs_second_factor",
			supportedSecondFactors: [{ strategy: "totp" }],
			firstFactorVerification: { strategy: "password" },
		});
		renderForm();
		expect(screen.getByLabelText("Password")).toBeDefined();
		expect(screen.queryByText("Verify it's you")).toBeNull();
	});

	it("shows a readable error on failure", async () => {
		password.mockResolvedValue({
			error: { errors: [{ message: "Invalid." }] },
		});
		renderForm();
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(await screen.findByText("Invalid.")).toBeDefined();
	});

	it("translates a Clerk API error by its nested code", async () => {
		password.mockResolvedValue({
			error: new ClerkAPIResponseError("Unprocessable Entity", {
				data: [
					{
						code: "form_password_incorrect",
						message: "Password is incorrect. Try again.",
						long_message: "Password is incorrect. Try again.",
					},
				],
				status: 422,
			}),
		});
		renderForm();
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(
			await screen.findByText("That password is incorrect."),
		).toBeDefined();
	});

	it("signs in with an emailed code", async () => {
		create.mockImplementation(
			ok({
				supportedFirstFactors: [
					{ strategy: "password" },
					{ strategy: "email_code" },
				],
			}),
		);
		sendCode.mockImplementation(ok());
		verifyCode.mockImplementation(ok({ status: "complete" }));
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Email me a sign-in code" }),
		);
		expect(
			await screen.findByText("We sent a 6-digit code to a@b.com."),
		).toBeDefined();
		expect(create).toHaveBeenCalledWith({ identifier: "a@b.com" });
		expect(sendCode).toHaveBeenCalled();
		fireEvent.change(screen.getByLabelText("Code"), {
			target: { value: "123456" },
		});
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		await vi.waitFor(() => expect(finalize).toHaveBeenCalled());
		expect(verifyCode).toHaveBeenCalledWith({ code: "123456" });
		expect(onSuccess).toHaveBeenCalled();
	});

	it("explains when the account cannot use a code", async () => {
		create.mockImplementation(
			ok({ supportedFirstFactors: [{ strategy: "password" }] }),
		);
		renderForm();
		fireEvent.click(
			screen.getByRole("button", { name: "Email me a sign-in code" }),
		);
		expect(
			await screen.findByText(
				"Sign-in codes aren't available for this account.",
			),
		).toBeDefined();
		expect(sendCode).not.toHaveBeenCalled();
	});
});
