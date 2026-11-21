/**
 * The second-factor step, shared by every way into a sign-in.
 *
 * `useSecondFactorHandoff` runs where the first factor finished (password,
 * emailed code, password reset, social provider) and only opens
 * `sign-in-second-factor`. It reads nothing from the attempt: after a social
 * sign-in Clerk swaps in a new `signIn` resource that the caller's hook has
 * not rendered yet, while the new screen's `useSignIn()` always sees it.
 *
 * `useSecondFactor` runs on that screen: it picks the default method, sends
 * its code once when it needs one (`sent` / `markSent` carry that through a
 * remount, since Clerk rate-limits sends), and verifies, switches method,
 * resends, and drops the attempt on the way back. Too many wrong codes lock
 * only that method (`locked`): a new texted or emailed code unlocks it, and an
 * authenticator app or backup code stays locked while another method can
 * still finish the same sign-in. A verified second factor
 * still needs `finalize()` before `isSignedIn` flips and the `(auth)` layout
 * redirects.
 */
import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	endsAttempt,
	locksMethod,
	type SecondFactorStrategy,
	secondFactorOptions,
	sendSecondFactorCode,
	sendsCode,
	verifySecondFactor,
} from "./second-factor";
import { useClerkFlow } from "./use-clerk-flow";

/** Where the sign-in came from; a reset says the password already changed. */
export type SecondFactorEntry = "signIn" | "reset";

const THROWN = { code: "network_error" };

export function useSecondFactorHandoff() {
	const router = useRouter();
	return useCallback(
		(from: SecondFactorEntry = "signIn") => {
			router.push({ pathname: "/sign-in-second-factor", params: { from } });
		},
		[router],
	);
}

export function useSecondFactor({
	sent,
	markSent,
}: {
	/** The first code already went out on an earlier mount. */
	sent: boolean;
	markSent: () => void;
}) {
	const { signIn, errors } = useSignIn();
	const flow = useClerkFlow(errors);
	const { run, fail, clear } = flow;
	// Fixed at mount: `cancel` empties the attempt before the screen leaves.
	const [options] = useState(() =>
		secondFactorOptions(signIn.supportedSecondFactors),
	);
	const [strategy, setStrategy] = useState<SecondFactorStrategy | null>(
		() => options[0]?.strategy ?? null,
	);
	const [sending, setSending] = useState(false);
	// After a switch, the last error (still in Clerk's `errors` signal until the
	// next request) was about the method left behind; hide it until the next
	// send or verify.
	const [switched, setSwitched] = useState(false);
	// The attempt expired or was dropped: only a new sign-in helps.
	const [ended, setEnded] = useState(false);
	// Methods with too many wrong codes on this attempt.
	const [lockedOut, setLockedOut] = useState<ReadonlySet<SecondFactorStrategy>>(
		() => new Set(),
	);
	const lock = useCallback((target: SecondFactorStrategy, on: boolean) => {
		setLockedOut((prev) => {
			if (prev.has(target) === on) return prev;
			const next = new Set(prev);
			if (on) next.add(target);
			else next.delete(target);
			return next;
		});
	}, []);

	const send = useCallback(
		async (next: SecondFactorStrategy): Promise<boolean> => {
			setSending(true);
			setSwitched(false);
			clear();
			try {
				const result = await sendSecondFactorCode(signIn, next);
				if (result.error) {
					if (endsAttempt(result.error)) setEnded(true);
					fail(result.error);
					return false;
				}
				// A new code starts its count of wrong codes over.
				lock(next, false);
				return true;
			} catch {
				fail(THROWN);
				return false;
			} finally {
				setSending(false);
			}
		},
		[signIn, clear, fail, lock],
	);

	// The default method's first code. The ref covers an effect run twice.
	const firstSend = useRef(sent);
	useEffect(() => {
		if (firstSend.current || !strategy || !sendsCode(strategy)) return;
		firstSend.current = true;
		markSent();
		void send(strategy);
	}, [strategy, send, markSent]);

	/** Re-sends the current method's code; false when nothing was sent. */
	const resend = useCallback(async (): Promise<boolean> => {
		if (sending || flow.busy || !strategy || !sendsCode(strategy)) {
			return false;
		}
		return send(strategy);
	}, [send, sending, flow.busy, strategy]);

	/** Switches method, sending its code first when it needs one. */
	const switchTo = useCallback(
		async (next: SecondFactorStrategy): Promise<boolean> => {
			if (sending || flow.busy || next === strategy) return false;
			firstSend.current = true;
			if (sendsCode(next) && !(await send(next))) return false;
			clear();
			setSwitched(true);
			setStrategy(next);
			return true;
		},
		[send, sending, flow.busy, strategy, clear],
	);

	const locked = !!strategy && lockedOut.has(strategy);

	const verify = useCallback(
		async (code: string) => {
			if (!strategy || sending || ended || locked) return;
			setSwitched(false);
			// A verified factor whose `finalize()` failed only needs the retry.
			if (signIn.status === "complete") {
				await run(() => signIn.finalize());
				return;
			}
			const verified = await run(async () => {
				const result = await verifySecondFactor(signIn, strategy, code.trim());
				if (result.error && endsAttempt(result.error)) setEnded(true);
				if (result.error && locksMethod(result.error)) lock(strategy, true);
				return result;
			});
			if (!verified) return;
			await run(() => signIn.finalize());
		},
		[signIn, run, strategy, sending, ended, locked, lock],
	);

	/** Drops the attempt so the next sign-in starts clean. */
	const cancel = useCallback(async () => {
		clear();
		try {
			await signIn.reset();
		} catch {
			// The attempt is dropped locally either way; nothing to show.
		}
	}, [signIn, clear]);

	return {
		options,
		strategy,
		switchTo,
		resend,
		sending,
		verify,
		cancel,
		ended,
		locked,
		busy: flow.busy,
		error: switched ? null : flow.error,
	};
}
