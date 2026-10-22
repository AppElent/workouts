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
vi.mock("@clerk/react", () => ({
	useSignIn: () => ({ signIn: {} }),
	useSignUp: () => ({ signUp }),
}));

function ok(update: Partial<typeof signUp> = {}) {
	return async () => {
		Object.assign(signUp, update);
		return { error: null };
	};
}

import { LocaleProvider } from "#/lib/i18n";
import { AuthConfigProvider } from "../AuthConfigProvider";
import { SignUpForm } from "../SignUpForm";

function render(ui: React.ReactElement) {
	return rtlRender(ui, {
		wrapper: ({ children }) => (
			<LocaleProvider initialLocale="en">{children}</LocaleProvider>
		),
	});
}

function renderForm(onSuccess = vi.fn()) {
	return render(
		<AuthConfigProvider>
			<SignUpForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
	);
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
