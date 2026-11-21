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
 * retry only resubmits the password. Once Clerk accepts the password the
 * stage is `saved`: the password can no longer change here, and a failed
 * `finalize()` is retried with `finish`. `finalize()` turns the completed
 * sign-in into a session; the `(auth)` layout then redirects and this screen
 * unmounts.
 *
 * `request`, `reset`, `resend` and `startOver` all act on the one Clerk
 * attempt, from both routes, so one module-wide lock lets only one run at a
 * time; `locked` reports this hook's own pending action to its screen.
 *
 * If Clerk asks for a second factor after accepting the new password (MFA,
 * or Device Trust on a new device), the stage is `saved` and the handoff
 * opens `sign-in-second-factor`.
 * Any other step this app cannot do is `unsupported`: the password has
 * changed but no session follows here.
 *
 * Resend and start-over turn a thrown SDK failure (no network) into the
 * catalog's network message instead of rejecting.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { useI18n } from "../i18n";
import { needsSecondFactor } from "./second-factor";
import { useClerkFlow } from "./use-clerk-flow";
import { useSecondFactorHandoff } from "./use-second-factor";

/** One Clerk sign-in attempt is shared by both reset routes. */
let attemptBusy = false;

/** Runs `action` unless another action on the attempt is still pending. */
async function exclusive<T>(blocked: T, action: () => Promise<T>): Promise<T> {
	if (attemptBusy) return blocked;
	attemptBusy = true;
	try {
		return await action();
	} finally {
		attemptBusy = false;
	}
}

/** `entering` until Clerk accepts the new password. */
export type ResetStage = "entering" | "saved" | "unsupported";

const THROWN = { code: "network_error" };

export function usePasswordReset() {
	const { signIn, errors } = useSignIn();
	const unsupportedText = useI18n().t.signIn.unsupportedStep;
	const flow = useClerkFlow(errors);
	const { run, idle, fail, clear } = flow;
	const toSecondFactor = useSecondFactorHandoff();
	const [resending, setResending] = useState(false);
	const [startingOver, setStartingOver] = useState(false);
	const [stage, setStage] = useState<ResetStage>("entering");

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
		[signIn, run, idle],
	);

	const resend = useCallback(
		(): Promise<boolean> =>
			exclusive(false, async () => {
				setResending(true);
				clear();
				let sent: Awaited<
					ReturnType<typeof signIn.resetPasswordEmailCode.sendCode>
				>;
				try {
					sent = await signIn.resetPasswordEmailCode.sendCode();
				} catch {
					fail(THROWN);
					return false;
				} finally {
					setResending(false);
				}
				if (sent.error) {
					fail(sent.error);
					return false;
				}
				return true;
			}),
		[signIn, clear, fail],
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
				} catch {
					fail(THROWN);
					return false;
				} finally {
					setStartingOver(false);
				}
				setStage("entering");
				return true;
			}),
		[signIn, clear, fail],
	);

	/**
	 * Turns the accepted password into a session: the second-factor step when
	 * Clerk wants one, else `finalize()`. Retried after a failure.
	 */
	const proceed = useCallback(async () => {
		if (needsSecondFactor(signIn.status)) {
			idle();
			toSecondFactor("reset");
			return;
		}
		if (signIn.status === "complete") {
			await run(() => signIn.finalize());
			return;
		}
		if (__DEV__) {
			console.warn(
				`[auth] password reset stopped at an unhandled status: ${signIn.status}`,
			);
		}
		setStage("unsupported");
		idle();
	}, [signIn, run, idle, toSecondFactor]);

	const finish = useCallback(
		(): Promise<void> => exclusive(undefined, proceed),
		[proceed],
	);

	const reset = useCallback(
		(code: string, password: string): Promise<void> =>
			exclusive(undefined, async () => {
				if (stage !== "entering") return;
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

				setStage("saved");
				await proceed();
			}),
		[signIn, run, proceed, stage],
	);

	return {
		request,
		resend,
		resending,
		startOver,
		reset,
		finish,
		stage,
		busy: flow.busy,
		/** True while any action on the attempt is pending. */
		locked: flow.busy || resending || startingOver,
		error: stage === "unsupported" ? unsupportedText : flow.error,
	};
}
