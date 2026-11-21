/**
 * Email + password, all the way to an active session.
 *
 * Clerk **Core 3** (`@clerk/expo`) trap: a successful `signIn.password()`
 * leaves the sign-in `'complete'` but **not** signed in. `finalize()` is
 * what promotes it to the active session — skipping it produces a flow that
 * reports success and leaves the person exactly where they were. The web
 * forms (`src/lib/auth`, `@clerk/react`) follow the same Core 3 contract.
 *
 * An account with MFA (or a new device under Device Trust) stops at a second
 * factor instead; the handoff opens `sign-in-second-factor` for it.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { useI18n } from "../i18n";
import { needsSecondFactor } from "./second-factor";
import { useClerkFlow } from "./use-clerk-flow";
import { useSecondFactorHandoff } from "./use-second-factor";

export function usePasswordSignIn() {
	const { signIn, errors } = useSignIn();
	const unsupportedText = useI18n().t.signIn.unsupportedStep;
	const flow = useClerkFlow(errors);
	const { run, idle } = flow;
	const toSecondFactor = useSecondFactorHandoff();
	const [unsupported, setUnsupported] = useState(false);

	const submit = useCallback(
		async (email: string, password: string) => {
			setUnsupported(false);
			const signedIn = await run(() =>
				signIn.password({ identifier: email.trim(), password }),
			);
			if (!signedIn) return;

			if (needsSecondFactor(signIn.status)) {
				idle();
				toSecondFactor();
				return;
			}

			if (signIn.status !== "complete") {
				if (__DEV__) {
					console.warn(
						`[auth] sign-in stopped at an unhandled status: ${signIn.status}`,
					);
				}
				setUnsupported(true);
				idle();
				return;
			}

			await run(() => signIn.finalize());
		},
		[signIn, run, idle, toSecondFactor],
	);

	return {
		submit,
		busy: flow.busy,
		error: unsupported ? unsupportedText : flow.error,
	};
}
