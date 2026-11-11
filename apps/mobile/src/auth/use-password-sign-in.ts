/**
 * Email + password, all the way to an active session.
 *
 * Clerk **Core 3** (`@clerk/expo`) trap: a successful `signIn.password()`
 * leaves the sign-in `'complete'` but **not** signed in. `finalize()` is
 * what promotes it to the active session — skipping it produces a flow that
 * reports success and leaves the person exactly where they were. The web
 * forms (`src/lib/auth`, `@clerk/react`) follow the same Core 3 contract.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { useI18n } from "../i18n";
import { useClerkFlow } from "./use-clerk-flow";

export function usePasswordSignIn() {
	const { signIn, errors } = useSignIn();
	const unsupportedText = useI18n().t.signIn.unsupportedStep;
	const flow = useClerkFlow(errors);
	const { run, idle } = flow;
	const [unsupported, setUnsupported] = useState(false);

	const submit = useCallback(
		async (email: string, password: string) => {
			setUnsupported(false);
			const signedIn = await run(() =>
				signIn.password({ identifier: email.trim(), password }),
			);
			if (!signedIn) return;

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
		[signIn, run, idle],
	);

	return {
		submit,
		busy: flow.busy,
		error: unsupported ? unsupportedText : flow.error,
	};
}
