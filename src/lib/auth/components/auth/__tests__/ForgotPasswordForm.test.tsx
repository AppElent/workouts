// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render as rtlRender,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const sendCode = vi.fn();
const verifyCode = vi.fn();
const submitPassword = vi.fn();
const finalize = vi.fn();
// Core 3 methods resolve to `{ error }` and update the resource in place.
const signIn = {
	status: "needs_identifier",
	create,
	resetPasswordEmailCode: { sendCode, verifyCode, submitPassword },
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
import { ForgotPasswordForm } from "../ForgotPasswordForm";

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
			<ForgotPasswordForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
	);
}

describe("ForgotPasswordForm", () => {
	afterEach(() => {
		cleanup();
		for (const m of [create, sendCode, verifyCode, submitPassword, finalize]) {
			m.mockReset();
		}
		signIn.status = "needs_identifier";
	});

	it("requests a reset code then sets a new password", async () => {
		create.mockImplementation(ok({ status: "needs_first_factor" }));
		sendCode.mockImplementation(ok());
		verifyCode.mockImplementation(ok({ status: "needs_new_password" }));
		submitPassword.mockImplementation(ok({ status: "complete" }));
		finalize.mockImplementation(ok());
		const onSuccess = vi.fn();
		renderForm(onSuccess);

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send code/i }));
		await vi.waitFor(() =>
			expect(create).toHaveBeenCalledWith({ identifier: "a@b.com" }),
		);

		fireEvent.change(await screen.findByLabelText(/code/i), {
			target: { value: "123456" },
		});
		expect(sendCode).toHaveBeenCalled();
		fireEvent.change(screen.getByLabelText(/new password/i), {
			target: { value: "newpw123!" },
		});
		fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
		await vi.waitFor(() => expect(finalize).toHaveBeenCalled());
		expect(verifyCode).toHaveBeenCalledWith({ code: "123456" });
		expect(submitPassword).toHaveBeenCalledWith({ password: "newpw123!" });
		expect(onSuccess).toHaveBeenCalled();
	});

	it("retries only the password after it is rejected", async () => {
		create.mockImplementation(ok({ status: "needs_first_factor" }));
		sendCode.mockImplementation(ok());
		verifyCode.mockImplementation(ok({ status: "needs_new_password" }));
		submitPassword
			.mockResolvedValueOnce({
				error: { errors: [{ message: "Password too weak." }] },
			})
			.mockImplementation(ok({ status: "complete" }));
		finalize.mockImplementation(ok());
		const onSuccess = vi.fn();
		renderForm(onSuccess);

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send code/i }));
		fireEvent.change(await screen.findByLabelText(/code/i), {
			target: { value: "123456" },
		});
		fireEvent.change(screen.getByLabelText(/new password/i), {
			target: { value: "weak" },
		});
		fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
		expect(await screen.findByText("Password too weak.")).toBeDefined();

		fireEvent.change(screen.getByLabelText(/new password/i), {
			target: { value: "newpw123!" },
		});
		fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
		await vi.waitFor(() => expect(finalize).toHaveBeenCalled());
		expect(verifyCode).toHaveBeenCalledTimes(1);
		expect(submitPassword).toHaveBeenLastCalledWith({ password: "newpw123!" });
		expect(onSuccess).toHaveBeenCalled();
	});
});
