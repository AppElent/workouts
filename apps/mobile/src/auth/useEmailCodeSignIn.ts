/**
 * Passwordless sign-in: email a 6-digit code, then trade it for a session.
 *
 * `send` runs on the sign-in screen (the address is already typed there) and
 * `verify` / `resend` on `sign-in-code`. Clerk's `signIn` resource survives
 * the navigation in between, the same way `signUp` does for `verify-email`.
 *
 * Core 3 again: calls resolve to `{ error }`, and a verified code still needs
 * `finalize()` before `isSignedIn` flips — at which point the `(auth)` layout
 * redirects and the caller unmounts, so `busy` is only cleared on failure.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { type CodedError, pickError } from "./clerkErrors";

export function useEmailCodeSignIn() {
	const { signIn, errors } = useSignIn();
	const [busy, setBusy] = useState(false);
	const [returned, setReturned] = useState<CodedError | null>(null);

	const send = useCallback(
		async (email: string): Promise<boolean> => {
			setBusy(true);
			setReturned(null);
			const sent = await signIn.emailCode.sendCode({
				emailAddress: email.trim(),
			});
			setBusy(false);
			if (sent.error) {
				setReturned(sent.error);
				return false;
			}
			return true;
		},
		[signIn],
	);

	/** Re-sends to the address of the sign-in already in progress. */
	const resend = useCallback(async (): Promise<boolean> => {
		setReturned(null);
		const sent = await signIn.emailCode.sendCode();
		if (sent.error) {
			setReturned(sent.error);
			return false;
		}
		return true;
	}, [signIn]);

	const verify = useCallback(
		async (code: string) => {
			setBusy(true);
			setReturned(null);
			const verified = await signIn.emailCode.verifyCode({ code });
			if (verified.error) {
				setReturned(verified.error);
				setBusy(false);
				return;
			}
			const finalized = await signIn.finalize();
			if (finalized.error) {
				setReturned(finalized.error);
				setBusy(false);
			}
		},
		[signIn],
	);

	return { send, resend, verify, busy, error: pickError(errors, returned) };
}
