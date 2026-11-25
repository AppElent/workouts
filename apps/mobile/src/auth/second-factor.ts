/**
 * The second factor a sign-in can ask for after its first one (password,
 * emailed code, social provider, or a password reset).
 *
 * Clerk stops a sign-in at `needs_second_factor` when the account has MFA on,
 * and at `needs_client_trust` when Device Trust wants a new device verified;
 * both are completed with the same `signIn.mfa` methods. Which methods are on
 * offer comes from `supportedSecondFactors`: only what the instance enables
 * and the account has set up. The order below picks the default: an
 * authenticator app needs nothing sent, a texted or emailed code comes next,
 * and backup codes are the last resort because each one works only once.
 */
import type { useSignIn } from "@clerk/expo";
import { clerkErrorCode } from "@foundry/core";
import type { CodedError } from "./clerk-errors";

export const SECOND_FACTOR_STRATEGIES = [
	"totp",
	"phone_code",
	"email_code",
	"backup_code",
] as const;
export type SecondFactorStrategy = (typeof SECOND_FACTOR_STRATEGIES)[number];

export type SignInFuture = ReturnType<typeof useSignIn>["signIn"];

/** The sign-in has passed its first factor and waits for a second. */
export function needsSecondFactor(status: string | null | undefined) {
	return status === "needs_second_factor" || status === "needs_client_trust";
}

export interface SecondFactorOption {
	strategy: SecondFactorStrategy;
	/** Masked phone number or address a code goes to, e.g. `+1*******55`. */
	safeIdentifier?: string;
}

/** The methods this app can complete, default first, one per strategy. */
export function secondFactorOptions(
	factors: readonly { strategy: string; safeIdentifier?: string }[] | null,
): SecondFactorOption[] {
	return SECOND_FACTOR_STRATEGIES.flatMap((strategy) => {
		const factor = factors?.find((f) => f.strategy === strategy);
		if (!factor) return [];
		return [
			factor.safeIdentifier
				? { strategy, safeIdentifier: factor.safeIdentifier }
				: { strategy },
		];
	});
}

/** Texted and emailed codes are sent first; the other methods need nothing. */
export function sendsCode(strategy: SecondFactorStrategy) {
	return strategy === "phone_code" || strategy === "email_code";
}

export function sendSecondFactorCode(
	signIn: SignInFuture,
	strategy: SecondFactorStrategy,
): Promise<{ error: CodedError | null }> {
	if (strategy === "phone_code") return signIn.mfa.sendPhoneCode();
	if (strategy === "email_code") return signIn.mfa.sendEmailCode();
	return Promise.resolve({ error: null });
}

export function verifySecondFactor(
	signIn: SignInFuture,
	strategy: SecondFactorStrategy,
	code: string,
): Promise<{ error: CodedError | null }> {
	switch (strategy) {
		case "totp":
			return signIn.mfa.verifyTOTP({ code });
		case "phone_code":
			return signIn.mfa.verifyPhoneCode({ code });
		case "email_code":
			return signIn.mfa.verifyEmailCode({ code });
		case "backup_code":
			return signIn.mfa.verifyBackupCode({ code });
	}
}

/**
 * Codes after which this attempt cannot finish: it expired or was dropped
 * while the screen waited. Too many wrong codes (`verification_failed`) is
 * not one: Clerk only locks the method that failed, so a new texted or
 * emailed code, or another method, still finishes the same sign-in (APP-526).
 */
const ATTEMPT_ENDED_CODES = new Set(["resource_not_found", "sign_in_expired"]);

export function endsAttempt(error: unknown) {
	const code = clerkErrorCode(error);
	return !!code && ATTEMPT_ENDED_CODES.has(code);
}

/** Too many wrong codes: this method is locked until it sends a new code. */
export function locksMethod(error: unknown) {
	return clerkErrorCode(error) === "verification_failed";
}
