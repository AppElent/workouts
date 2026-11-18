/**
 * Forgotten password: email a 6-digit reset code, then trade the code and a
 * new password for a session. Mirrors the web `ForgotPasswordForm`.
 *
 * `request` runs on `forgot-password`, `reset` / `resend` on `reset-password`;
 * Clerk's `signIn` resource survives the navigation in between. Resetting
 * signs the account out of its other sessions: someone who lost their
 * password may also have lost a device.
 *
 * A rejected password (too short, breached) leaves the code verified, so a
 * retry only resubmits the password; a failed `finalize()` leaves the attempt
 * complete, so a retry only finalizes. `finalize()` turns the completed
 * sign-in into a session; the `(auth)` layout then redirects and this screen
 * unmounts.
 *
 * `request`, `reset`, `resend` and `startOver` all act on the one Clerk
 * attempt, so only one runs at a time; `locked` reports it to the screen.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { useClerkFlow } from "./use-clerk-flow";

export function usePasswordReset() {
	const { signIn, errors } = useSignIn();
	const unsupportedText = useI18n().t.signIn.unsupportedStep;
	const flow = useClerkFlow(errors);
	const { run, idle, fail, clear } = flow;
	const [resending, setResending] = useState(false);
	const [startingOver, setStartingOver] = useState(false);
	const [unsupported, setUnsupported] = useState(false);
	const inFlight = useRef(false);

	/** Runs `action` unless another action on the attempt is still pending. */
	const exclusive = useCallback(
		async <T>(blocked: T, action: () => Promise<T>): Promise<T> => {
			if (inFlight.current) return blocked;
			inFlight.current = true;
			try {
				return await action();
			} finally {
				inFlight.current = false;
			}
		},
		[],
	);

	const request = useCallback(
		(email: string): Promise<boolean> =>
			exclusive(false, async () => {
				const sent = await run(
					() => signIn.create({ identifier: email.trim() }),
					() => signIn.resetPasswordEmailCode.sendCode(),
				);
				idle();
				return sent;
			}),
		[signIn, run, idle, exclusive],
	);

	const resend = useCallback(
		(): Promise<boolean> =>
			exclusive(false, async () => {
				setResending(true);
				clear();
				const sent = await signIn.resetPasswordEmailCode.sendCode();
				setResending(false);
				if (sent.error) {
					fail(sent.error);
					return false;
				}
				return true;
			}),
		[signIn, clear, fail, exclusive],
	);

	/**
	 * Drops the attempt so a corrected address starts a fresh reset. False
	 * while another action is pending: the screen then stays put.
	 */
	const startOver = useCallback(
		(): Promise<boolean> =>
			exclusive(false, async () => {
				setStartingOver(true);
				clear();
				try {
					await signIn.reset();
				} finally {
					setStartingOver(false);
				}
				return true;
			}),
		[signIn, clear, exclusive],
	);

	const reset = useCallback(
		(code: string, password: string): Promise<void> =>
			exclusive(undefined, async () => {
				setUnsupported(false);
				// A previous submit already set the password; only finalize is left.
				if (signIn.status !== "complete") {
					const verify = () =>
						signIn.resetPasswordEmailCode.verifyCode({ code });
					const submit = () =>
						signIn.resetPasswordEmailCode.submitPassword({
							password,
							signOutOfOtherSessions: true,
						});
					const saved = await run(
						...(signIn.status === "needs_new_password" ? [] : [verify]),
						submit,
					);
					if (!saved) return;
				}

				if (signIn.status !== "complete") {
					if (__DEV__) {
						console.warn(
							`[auth] password reset stopped at an unhandled status: ${signIn.status}`,
						);
					}
					setUnsupported(true);
					idle();
					return;
				}

				await run(() => signIn.finalize());
			}),
		[signIn, run, idle, exclusive],
	);

	return {
		request,
		resend,
		resending,
		startOver,
		reset,
		busy: flow.busy,
		/** True while any action on the attempt is pending. */
		locked: flow.busy || resending || startingOver,
		error: unsupported ? unsupportedText : flow.error,
	};
}
