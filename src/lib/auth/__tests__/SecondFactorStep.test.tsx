// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render as rtlRender,
	screen,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mfa = {
	sendEmailCode: vi.fn(),
	sendPhoneCode: vi.fn(),
	verifyEmailCode: vi.fn(),
	verifyPhoneCode: vi.fn(),
	verifyTOTP: vi.fn(),
	verifyBackupCode: vi.fn(),
};
const finalize = vi.fn();
const reset = vi.fn();
// Core 3 methods resolve to `{ error }` and update the resource in place.
const signIn = {
	status: "needs_second_factor",
	supportedSecondFactors: [] as { strategy: string; safeIdentifier?: string }[],
	mfa,
	finalize,
	reset,
};
vi.mock("@clerk/react", () => ({ useSignIn: () => ({ signIn }) }));

function ok(update: Partial<typeof signIn> = {}) {
	return async () => {
		Object.assign(signIn, update);
		return { error: null };
	};
}

function clerkError(code: string, message = "Clerk says no.") {
	return async () => ({ error: { errors: [{ code, message }] } });
}

import { LocaleProvider } from "#/lib/i18n";
import { SecondFactorStep } from "../SecondFactorStep";

function renderStep(
	props: Partial<React.ComponentProps<typeof SecondFactorStep>> = {},
) {
	const onSuccess = vi.fn();
	const onBack = vi.fn();
	rtlRender(
		<StrictMode>
			<SecondFactorStep onSuccess={onSuccess} onBack={onBack} {...props} />
		</StrictMode>,
		{
			wrapper: ({ children }) => (
				<LocaleProvider initialLocale="en">{children}</LocaleProvider>
			),
		},
	);
	return { onSuccess, onBack };
}

function enter(label: string, value: string) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
	fireEvent.click(screen.getByRole("button", { name: "Verify" }));
}

const ALL = [
	{ strategy: "backup_code" },
	{ strategy: "email_code", safeIdentifier: "a***@b.com" },
	{ strategy: "totp" },
	{ strategy: "passkey" },
];

describe("SecondFactorStep", () => {
	beforeEach(() => {
		finalize.mockImplementation(ok());
		reset.mockImplementation(ok({ status: "needs_identifier" }));
		mfa.sendEmailCode.mockImplementation(ok());
	});

	afterEach(() => {
		cleanup();
		for (const m of [finalize, reset, ...Object.values(mfa)]) m.mockReset();
		signIn.status = "needs_second_factor";
		signIn.supportedSecondFactors = [];
	});

	it("defaults to the authenticator app and signs in with its code", async () => {
		signIn.supportedSecondFactors = ALL;
		mfa.verifyTOTP.mockImplementation(ok({ status: "complete" }));
		const { onSuccess } = renderStep();
		expect(
			screen.getByText("Enter the 6-digit code from your authenticator app."),
		).toBeDefined();
		expect(mfa.sendEmailCode).not.toHaveBeenCalled();
		enter("Code", " 424242 ");
		await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
		expect(mfa.verifyTOTP).toHaveBeenCalledWith({ code: "424242" });
		expect(finalize).toHaveBeenCalled();
	});

	it("offers the other methods in order and skips ones it can't complete", () => {
		signIn.supportedSecondFactors = ALL;
		renderStep();
		const links = screen
			.getAllByRole("button")
			.map((b) => b.textContent)
			.filter((t) => t !== "Verify");
		expect(links).toEqual([
			"Email a code to a***@b.com",
			"Use a backup code",
			"Back to sign in",
		]);
	});

	it("sends an emailed code once on mount, even under StrictMode", async () => {
		signIn.supportedSecondFactors = [
			{ strategy: "email_code", safeIdentifier: "a***@b.com" },
		];
		mfa.verifyEmailCode.mockImplementation(ok({ status: "complete" }));
		const { onSuccess } = renderStep();
		expect(
			screen.getByText("We sent a 6-digit code to a***@b.com."),
		).toBeDefined();
		await vi.waitFor(() => expect(mfa.sendEmailCode).toHaveBeenCalledTimes(1));
		await screen.findByRole("button", { name: "Verify" });
		enter("Code", "424242");
		await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
		expect(mfa.verifyEmailCode).toHaveBeenCalledWith({ code: "424242" });
	});

	it("switches to a backup code", async () => {
		signIn.supportedSecondFactors = ALL;
		mfa.verifyBackupCode.mockImplementation(ok({ status: "complete" }));
		const { onSuccess } = renderStep();
		fireEvent.click(screen.getByRole("button", { name: "Use a backup code" }));
		expect(
			await screen.findByText("Enter one of the backup codes you saved."),
		).toBeDefined();
		enter("Backup code", "abcd-efgh");
		await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
		expect(mfa.verifyBackupCode).toHaveBeenCalledWith({ code: "abcd-efgh" });
	});

	it("sends a code before switching to an emailed one", async () => {
		signIn.supportedSecondFactors = ALL;
		renderStep();
		fireEvent.click(
			screen.getByRole("button", { name: "Email a code to a***@b.com" }),
		);
		expect(
			await screen.findByText("We sent a 6-digit code to a***@b.com."),
		).toBeDefined();
		expect(mfa.sendEmailCode).toHaveBeenCalledTimes(1);
	});

	it("stays on the current method when sending the new one's code fails", async () => {
		signIn.supportedSecondFactors = ALL;
		mfa.sendEmailCode.mockImplementation(clerkError("too_many_requests"));
		renderStep();
		fireEvent.click(
			screen.getByRole("button", { name: "Email a code to a***@b.com" }),
		);
		expect(
			await screen.findByText(
				"Too many attempts. Wait a moment and try again.",
			),
		).toBeDefined();
		expect(
			screen.getByText("Enter the 6-digit code from your authenticator app."),
		).toBeDefined();
	});

	it("keeps an emailed-code attempt open after too many wrong codes, for a new code", async () => {
		signIn.supportedSecondFactors = [{ strategy: "email_code" }];
		mfa.verifyEmailCode.mockImplementation(clerkError("verification_failed"));
		const { onBack } = renderStep();
		await vi.waitFor(() => expect(mfa.sendEmailCode).toHaveBeenCalledTimes(1));
		await screen.findByRole("button", { name: "Verify" });
		enter("Code", "000000");
		expect(
			await screen.findByText("Too many wrong codes. Request a new one."),
		).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
		expect(await screen.findByText("A new code is on its way.")).toBeDefined();
		expect(mfa.sendEmailCode).toHaveBeenCalledTimes(2);
		expect(reset).not.toHaveBeenCalled();
		expect(onBack).not.toHaveBeenCalled();
	});

	it("points to another method after too many wrong authenticator codes", async () => {
		signIn.supportedSecondFactors = ALL;
		mfa.verifyTOTP.mockImplementation(clerkError("verification_failed"));
		renderStep();
		enter("Code", "000000");
		expect(
			await screen.findByText(
				"Too many wrong codes for this method. Use another method, or go back and sign in again.",
			),
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Use a backup code" }),
		).toBeDefined();
	});

	it("shows a wrong code and lets the person try again", async () => {
		signIn.supportedSecondFactors = [{ strategy: "totp" }];
		mfa.verifyTOTP
			.mockImplementationOnce(clerkError("form_code_incorrect"))
			.mockImplementationOnce(ok({ status: "complete" }));
		const { onSuccess } = renderStep();
		enter("Code", "111111");
		expect(await screen.findByText("That code is incorrect.")).toBeDefined();
		enter("Code", "424242");
		await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
	});

	it("ends at an expired attempt and only offers the way back", async () => {
		signIn.supportedSecondFactors = [{ strategy: "totp" }];
		mfa.verifyTOTP.mockImplementation(clerkError("sign_in_expired"));
		const { onBack } = renderStep();
		enter("Code", "424242");
		expect(
			await screen.findByText(
				"This sign-in took too long and can't continue. Go back and sign in again.",
			),
		).toBeDefined();
		expect(screen.queryByLabelText("Code")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
		await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
		expect(reset).toHaveBeenCalled();
	});

	it("only retries finalize once the factor is verified", async () => {
		signIn.supportedSecondFactors = [{ strategy: "totp" }];
		mfa.verifyTOTP.mockImplementation(ok({ status: "complete" }));
		finalize
			.mockImplementationOnce(clerkError("network_error"))
			.mockImplementationOnce(ok());
		const { onSuccess } = renderStep();
		enter("Code", "424242");
		expect(
			await screen.findByText("Can't reach the server. Check your connection."),
		).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Verify" }));
		await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
		expect(mfa.verifyTOTP).toHaveBeenCalledTimes(1);
		expect(finalize).toHaveBeenCalledTimes(2);
	});

	it("explains when no method this form can complete is set up", () => {
		signIn.supportedSecondFactors = [{ strategy: "passkey" }];
		renderStep();
		expect(
			screen.getByText(
				"Your account's second sign-in step isn't available here. Contact support to sign in.",
			),
		).toBeDefined();
	});

	it("drops the attempt on the way back", async () => {
		signIn.supportedSecondFactors = [{ strategy: "totp" }];
		const { onBack } = renderStep();
		fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
		await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
		expect(reset).toHaveBeenCalled();
	});

	it("shows the notice it was opened with", () => {
		signIn.supportedSecondFactors = [{ strategy: "totp" }];
		renderStep({ notice: "Your password is changed." });
		expect(screen.getByText("Your password is changed.")).toBeDefined();
	});
});
