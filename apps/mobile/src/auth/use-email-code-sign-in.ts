/**
 * Passwordless sign-in: email a 6-digit code, then trade it for a session.
 *
 * `send` runs on the sign-in screen (the address is already typed there) and
 * `verify` / `resend` on `sign-in-code`. Clerk's `signIn` resource survives
 * the navigation in between, the same way `signUp` does for `verify-email`.
 * A verified code still needs `finalize()` before `isSignedIn` flips.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { useClerkFlow } from "./use-clerk-flow";

export function useEmailCodeSignIn() {
	const { signIn, errors } = useSignIn();
	const flow = useClerkFlow(errors);
	const { run, idle, fail, clear } = flow;
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
			await run(
				() => signIn.emailCode.verifyCode({ code }),
				() => signIn.finalize(),
			);
		},
		[signIn, run],
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
