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
 * resends, and drops the attempt on the way back. A verified second factor
 * still needs `finalize()` before `isSignedIn` flips and the `(auth)` layout
 * redirects.
 */
import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	endsAttempt,
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
	const options = useMemo(
		() => secondFactorOptions(signIn.supportedSecondFactors),
		[signIn.supportedSecondFactors],
	);
	const [strategy, setStrategy] = useState<SecondFactorStrategy | null>(
		() => options[0]?.strategy ?? null,
	);
	const [sending, setSending] = useState(false);
	// Too many wrong codes, or the attempt expired: only a new sign-in helps.
	const [ended, setEnded] = useState(false);

	const send = useCallback(
		async (next: SecondFactorStrategy): Promise<boolean> => {
			setSending(true);
			clear();
			try {
				const sent = await sendSecondFactorCode(signIn, next);
				if (sent.error) {
					if (endsAttempt(sent.error)) setEnded(true);
					fail(sent.error);
					return false;
				}
				return true;
			} catch {
				fail(THROWN);
				return false;
			} finally {
				setSending(false);
			}
		},
		[signIn, clear, fail],
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
			setStrategy(next);
			return true;
		},
		[send, sending, flow.busy, strategy, clear],
	);

	const verify = useCallback(
		async (code: string) => {
			if (!strategy || sending || ended) return;
			const verified = await run(async () => {
				const result = await verifySecondFactor(signIn, strategy, code.trim());
				if (result.error && endsAttempt(result.error)) setEnded(true);
				return result;
			});
			if (!verified) return;
			await run(() => signIn.finalize());
		},
		[signIn, run, strategy, sending, ended],
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
		busy: flow.busy,
		error: flow.error,
	};
}
