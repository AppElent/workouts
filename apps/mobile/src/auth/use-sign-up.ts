/**
 * Create an account: email, password, then a code to prove the address.
 *
 * The code is requested here, before navigating, so `verify-email` is only
 * ever reached with a code already in flight. Sending it from the verify
 * screen's mount would re-send on every remount, and Clerk rate-limits that.
 */
import { useSignUp as useClerkSignUp } from "@clerk/expo";
import { useCallback } from "react";
import { useClerkFlow } from "./use-clerk-flow";

export function useSignUp() {
	const { signUp, errors } = useClerkSignUp();
	const flow = useClerkFlow(errors);
	const { run, idle } = flow;

	/** `true` once the account exists and its verification code is on its way. */
	const create = useCallback(
		async (email: string, password: string): Promise<boolean> => {
			const created = await run(
				() => signUp.password({ emailAddress: email.trim(), password }),
				() => signUp.verifications.sendEmailCode(),
			);
			idle();
			return created;
		},
		[signUp, run, idle],
	);

	return { create, busy: flow.busy, error: flow.error };
}
