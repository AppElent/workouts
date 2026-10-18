// @vitest-environment jsdom
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
// Core 3 methods resolve to `{ error }` and update the resource in place.
const signIn = {
	status: "needs_identifier",
	supportedFirstFactors: [] as { strategy: string }[],
	create,
	password,
	emailCode: { sendCode, verifyCode },
	finalize,
};
vi.mock("@clerk/react", () => ({ useSignIn: () => ({ signIn }) }));

function ok(update: Partial<typeof signIn> = {}) {
	return async () => {
		Object.assign(signIn, update);
		return { error: null };
	};
}

import { LocaleProvider } from "#/lib/i18n";
import { AuthConfigProvider } from "../AuthConfigProvider";
import { SignInForm } from "../SignInForm";

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
			<SignInForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
	);
}

describe("SignInForm", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
		for (const m of [create, password, sendCode, verifyCode, finalize]) {
			m.mockReset();
		}
		signIn.status = "needs_identifier";
		signIn.supportedFirstFactors = [];
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

	it("does not activate a sign-in that needs another step", async () => {
		password.mockImplementation(ok({ status: "needs_second_factor" }));
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		await vi.waitFor(() => expect(password).toHaveBeenCalled());
		expect(finalize).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("shows a readable error on failure", async () => {
		password.mockResolvedValue({
			error: { errors: [{ message: "Invalid." }] },
		});
		renderForm();
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(await screen.findByText("Invalid.")).toBeDefined();
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
