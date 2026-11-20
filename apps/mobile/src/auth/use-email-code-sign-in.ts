/**
 * Passwordless sign-in: email a 6-digit code, then trade it for a session.
 *
 * `send` runs on the sign-in screen (the address is already typed there) and
 * `verify` / `resend` on `sign-in-code`. Clerk's `signIn` resource survives
 * the navigation in between, the same way `signUp` does for `verify-email`.
 * A verified code still needs `finalize()` before `isSignedIn` flips, unless
 * the account has MFA: then the handoff opens `sign-in-second-factor`.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { needsSecondFactor } from "./second-factor";
import { useClerkFlow } from "./use-clerk-flow";
import { useSecondFactorHandoff } from "./use-second-factor";

export function useEmailCodeSignIn() {
	const { signIn, errors } = useSignIn();
	const flow = useClerkFlow(errors);
	const { run, idle, fail, clear } = flow;
	const toSecondFactor = useSecondFactorHandoff();
	const [resending, setResending] = useState(false);

	const send = useCallback(
		async (email: string): Promise<boolean> => {
			const sent = await run(() =>
				signIn.emailCode.sendCode({ emailAddress: email.trim() }),
			);
			idle();
			return sent;
		},
		[signIn, run, idle],
	);

	/** Re-sends to the address of the sign-in already in progress. */
	const resend = useCallback(async (): Promise<boolean> => {
		if (resending) return false;
		setResending(true);
		clear();
		const sent = await signIn.emailCode.sendCode();
		setResending(false);
		if (sent.error) {
			fail(sent.error);
			return false;
		}
		return true;
	}, [signIn, resending, clear, fail]);

	/**
	 * Drops the attempt so a corrected address starts a fresh sign-in: once
	 * one exists, `sendCode` must not be given an address again.
	 */
	const startOver = useCallback(async () => {
		clear();
		await signIn.reset();
	}, [signIn, clear]);

	const verify = useCallback(
		async (code: string) => {
			const verified = await run(() => signIn.emailCode.verifyCode({ code }));
			if (!verified) return;
			if (needsSecondFactor(signIn.status)) {
				idle();
				toSecondFactor();
				return;
			}
			await run(() => signIn.finalize());
		},
		[signIn, run, idle, toSecondFactor],
	);

	return {
		send,
		resend,
		resending,
		startOver,
		verify,
		busy: flow.busy,
		error: flow.error,
	};
}
