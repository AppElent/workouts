/**
 * The 6-digit code that proves a new account's address. The sign-up lives on
 * Clerk's `signUp` resource, which survives the navigation from `sign-up`;
 * `finalize()` turns a verified sign-up into a session.
 */
import { useSignUp } from "@clerk/expo";
import { useCallback } from "react";
import { useClerkFlow } from "./use-clerk-flow";

export function useVerifyEmail() {
	const { signUp, errors } = useSignUp();
	const flow = useClerkFlow(errors);
	const { run, fail, clear } = flow;

	const verify = useCallback(
		async (code: string) => {
			await run(
				() => signUp.verifications.verifyEmailCode({ code }),
				() => signUp.finalize(),
			);
		},
		[signUp, run],
	);

	const resend = useCallback(async (): Promise<boolean> => {
		clear();
		const sent = await signUp.verifications.sendEmailCode();
		if (sent.error) {
			fail(sent.error);
			return false;
		}
		return true;
	}, [signUp, clear, fail]);

	return { verify, resend, busy: flow.busy, error: flow.error };
}
