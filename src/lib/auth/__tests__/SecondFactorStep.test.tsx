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
interface Verification {
	strategy: string | null;
	status: string | null;
	expireAt: Date | null;
}
const NOT_STARTED: Verification = {
	strategy: null,
	status: null,
	expireAt: null,
};
// Core 3 methods resolve to `{ error }` and update the resource in place.
const signIn = {
	status: "needs_second_factor",
	supportedSecondFactors: [] as { strategy: string; safeIdentifier?: string }[],
	secondFactorVerification: NOT_STARTED,
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
	locale: "en" | "nl" = "en",
) {
	const onSuccess = vi.fn();
	const onBack = vi.fn();
	rtlRender(
		<StrictMode>
			<SecondFactorStep onSuccess={onSuccess} onBack={onBack} {...props} />
		</StrictMode>,
		{
			wrapper: ({ children }) => (
				<LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
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
		mfa.sendPhoneCode.mockImplementation(ok());
	});

	afterEach(() => {
		cleanup();
		for (const m of [finalize, reset, ...Object.values(mfa)]) m.mockReset();
		signIn.status = "needs_second_factor";
		signIn.supportedSecondFactors = [];
		signIn.secondFactorVerification = NOT_STARTED;
	});

	describe("on an attempt with a method already going", () => {
		const EXPIRED =
			"The code we sent to a***@b.com has expired. Choose “Send a new code” below.";
		const SENT = "We sent a 6-digit code to a***@b.com.";
		const past = () => new Date(Date.now() - 1000);
		const future = () => new Date(Date.now() + 60_000);

		function started(
			strategy: string,
			status = "unverified",
			expireAt: Date | null = future(),
		) {
			signIn.supportedSecondFactors = ALL;
			signIn.secondFactorVerification = { strategy, status, expireAt };
		}

		it.each([
			["totp", "unverified", null],
			["totp", "expired", past()],
			["backup_code", "unverified", null],
			["backup_code", "expired", past()],
		] as const)(
			"reopens on %s (%s) with its own prompt and sends nothing",
			(strategy, status, expireAt) => {
				started(strategy, status, expireAt);
				signIn.supportedSecondFactors = [
					{ strategy },
					{ strategy: "email_code", safeIdentifier: "a***@b.com" },
				];
				renderStep();
				expect(
					screen.getByText(
						strategy === "totp"
							? "Enter the 6-digit code from your authenticator app."
							: "Enter one of the backup codes you saved.",
					),
				).toBeDefined();
				expect(mfa.sendEmailCode).not.toHaveBeenCalled();
			},
		);

		it.each(["passkey", "phone_code"])(
			"starts on the default when %s is not on offer, even if it expired",
			async (strategy) => {
				started(strategy, "expired", past());
				signIn.supportedSecondFactors = [
					{ strategy: "email_code", safeIdentifier: "a***@b.com" },
					{ strategy: "passkey" },
				];
				renderStep();
				expect(screen.getByText(SENT)).toBeDefined();
				await vi.waitFor(() =>
					expect(mfa.sendEmailCode).toHaveBeenCalledTimes(1),
				);
			},
		);

		it.each([
			["a status of expired", "expired", null],
			["an expireAt in the past", "unverified", past()],
		] as const)(
			"says the code expired at %s, until a new one is sent",
			async (_, status, expireAt) => {
				started("email_code", status, expireAt);
				renderStep();
				expect(screen.getByText(EXPIRED)).toBeDefined();
				expect(screen.queryByText(SENT)).toBeNull();
				expect(mfa.sendEmailCode).not.toHaveBeenCalled();
				fireEvent.click(
					screen.getByRole("button", { name: "Send a new code" }),
				);
				expect(await screen.findByText(SENT)).toBeDefined();
				expect(screen.queryByText(EXPIRED)).toBeNull();
				expect(mfa.sendEmailCode).toHaveBeenCalledTimes(1);
			},
		);

		it("keeps saying the code expired when a new one can't be sent", async () => {
			started("email_code", "expired", past());
			mfa.sendEmailCode.mockImplementation(clerkError("too_many_requests"));
			renderStep();
			fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
			await screen.findByText(
				"Too many attempts. Wait a moment and try again.",
			);
			expect(screen.getByText(EXPIRED)).toBeDefined();
		});

		it("drops the expired prompt on switching to another method", async () => {
			started("email_code", "expired", past());
			renderStep();
			fireEvent.click(
				screen.getByRole("button", { name: "Use your authenticator app" }),
			);
			expect(
				await screen.findByText(
					"Enter the 6-digit code from your authenticator app.",
				),
			).toBeDefined();
			fireEvent.click(
				screen.getByRole("button", { name: "Email a code to a***@b.com" }),
			);
			expect(await screen.findByText(SENT)).toBeDefined();
			expect(mfa.sendEmailCode).toHaveBeenCalledTimes(1);
		});

		it("keeps the usual prompt while the code still works", () => {
			started("email_code");
			renderStep();
			expect(screen.getByText(SENT)).toBeDefined();
			expect(mfa.sendEmailCode).not.toHaveBeenCalled();
		});

		it("says it in Dutch", () => {
			started("email_code", "expired", past());
			renderStep({}, "nl");
			expect(
				screen.getByText(
					"De code die we naar a***@b.com hebben gestuurd, is verlopen. Kies hieronder ‘Stuur een nieuwe code’.",
				),
			).toBeDefined();
			expect(
				screen.getByRole("button", { name: "Stuur een nieuwe code" }),
			).toBeDefined();
		});
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

	it("texts the first code and sends a new one on request", async () => {
		signIn.supportedSecondFactors = [
			{ strategy: "phone_code", safeIdentifier: "+31******89" },
		];
		renderStep();
		expect(
			screen.getByText("We texted a 6-digit code to +31******89."),
		).toBeDefined();
		await vi.waitFor(() => expect(mfa.sendPhoneCode).toHaveBeenCalledTimes(1));
		fireEvent.click(
			await screen.findByRole("button", { name: "Send a new code" }),
		);
		expect(await screen.findByText("A new code is on its way.")).toBeDefined();
		expect(mfa.sendPhoneCode).toHaveBeenCalledTimes(2);
	});

	it("asks for the code instead of sending an empty one", () => {
		signIn.supportedSecondFactors = [{ strategy: "totp" }];
		renderStep();
		enter("Code", "  ");
		expect(screen.getByText("Enter the code first.")).toBeDefined();
		expect(mfa.verifyTOTP).not.toHaveBeenCalled();
	});

	it("keeps its opening notice while the first code is sent", async () => {
		signIn.supportedSecondFactors = [{ strategy: "email_code" }];
		renderStep({ notice: "Your password has been changed." });
		await vi.waitFor(() => expect(mfa.sendEmailCode).toHaveBeenCalledTimes(1));
		await screen.findByRole("button", { name: "Verify" });
		expect(screen.getByText("Your password has been changed.")).toBeDefined();
	});

	it("moves focus to the message when the attempt ends", async () => {
		signIn.supportedSecondFactors = [{ strategy: "totp" }];
		mfa.verifyTOTP.mockImplementation(clerkError("sign_in_expired"));
		renderStep();
		enter("Code", "424242");
		const message = await screen.findByText(
			"This sign-in took too long and can't continue. Go back and sign in again.",
		);
		await vi.waitFor(() =>
			expect(document.activeElement?.contains(message)).toBe(true),
		);
	});

	it("shows the notice it was opened with", () => {
		signIn.supportedSecondFactors = [{ strategy: "totp" }];
		renderStep({ notice: "Your password has been changed." });
		expect(screen.getByText("Your password has been changed.")).toBeDefined();
	});
});
