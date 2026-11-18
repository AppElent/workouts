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
 * retry only resubmits the password. `finalize()` turns the completed sign-in
 * into a session; the `(auth)` layout then redirects and this screen unmounts.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { useI18n } from "../i18n";
import { useClerkFlow } from "./use-clerk-flow";

export function usePasswordReset() {
	const { signIn, errors } = useSignIn();
	const unsupportedText = useI18n().t.signIn.unsupportedStep;
	const flow = useClerkFlow(errors);
	const { run, idle, fail, clear } = flow;
	const [resending, setResending] = useState(false);
	const [unsupported, setUnsupported] = useState(false);

	const request = useCallback(
		async (email: string): Promise<boolean> => {
			const sent = await run(
				() => signIn.create({ identifier: email.trim() }),
				() => signIn.resetPasswordEmailCode.sendCode(),
			);
			idle();
			return sent;
		},
		[signIn, run, idle],
	);

	const resend = useCallback(async (): Promise<boolean> => {
		if (resending) return false;
		setResending(true);
		clear();
		const sent = await signIn.resetPasswordEmailCode.sendCode();
		setResending(false);
		if (sent.error) {
			fail(sent.error);
			return false;
		}
		return true;
	}, [signIn, resending, clear, fail]);

	/** Drops the attempt so a corrected address starts a fresh reset. */
	const startOver = useCallback(async () => {
		clear();
		await signIn.reset();
	}, [signIn, clear]);

	const reset = useCallback(
		async (code: string, password: string) => {
			setUnsupported(false);
			const verify = () => signIn.resetPasswordEmailCode.verifyCode({ code });
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
		},
		[signIn, run, idle],
	);

	return {
		request,
		resend,
		resending,
		startOver,
		reset,
		busy: flow.busy,
		error: unsupported ? unsupportedText : flow.error,
	};
}
