/**
 * Apple, Google and Microsoft, all the way to an active session.
 *
 * Apple on iOS goes through the native sheet (`@clerk/expo/apple`) — App
 * Store review requires it once any other social login is offered. Everything
 * else opens the provider in an in-app browser via Core 3's experimental
 * `useSSO()`, which also turns an unknown account into a sign-up and
 * activates the session itself. That browser returns to
 * `<scheme>://sso-callback` (one scheme per install variant, see
 * `app.config.ts`), which must be on the Clerk instance's allowed redirect URLs.
 *
 * An account with MFA (or a new device under Device Trust) comes back with
 * no session and the sign-in at a second factor; the handoff opens
 * `sign-in-second-factor` for it, as after a password.
 *
 * Backing out of the sheet or browser is not an error and shows nothing.
 */

import { useSignInWithApple } from "@clerk/expo/apple";
import { useSSO } from "@clerk/expo/experimental";
import {
	type ClerkErrorMessageKey,
	clerkErrorCode,
	type SocialSignInProvider,
} from "@foundry/core";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { useI18n } from "../i18n";
import { clerkErrorKey } from "./clerk-errors";
import { needsSecondFactor } from "./second-factor";
import { useSecondFactorHandoff } from "./use-second-factor";

export function useSocialSignIn() {
	const { t } = useI18n();
	const { startSSOFlow } = useSSO();
	const { startAppleAuthenticationFlow } = useSignInWithApple();
	const toSecondFactor = useSecondFactorHandoff();
	const [pending, setPending] = useState<SocialSignInProvider | null>(null);
	const [error, setError] = useState<
		ClerkErrorMessageKey | "incomplete" | null
	>(null);

	const start = useCallback(
		async (provider: SocialSignInProvider) => {
			setPending(provider);
			setError(null);
			try {
				if (provider === "apple" && Platform.OS === "ios") {
					const { createdSessionId, setActive, signIn } =
						await startAppleAuthenticationFlow();
					if (createdSessionId && setActive) {
						await setActive({ session: createdSessionId });
						return;
					}
					if (needsSecondFactor(signIn?.status)) {
						setPending(null);
						toSecondFactor();
						return;
					}
				} else {
					const { createdSessionId, signIn, authSessionResult } =
						await startSSOFlow({ strategy: `oauth_${provider}` });
					if (authSessionResult?.type !== "success") {
						setPending(null);
						return;
					}
					if (createdSessionId || signIn?.existingSession) return;
					if (needsSecondFactor(signIn?.status)) {
						setPending(null);
						toSecondFactor();
						return;
					}
				}
				setError("incomplete");
			} catch (err) {
				if (clerkErrorCode(err) !== "ERR_REQUEST_CANCELED") {
					setError(clerkErrorKey(err));
				}
			}
			setPending(null);
		},
		[startSSOFlow, startAppleAuthenticationFlow, toSecondFactor],
	);

	return {
		start,
		pending,
		error:
			error === "incomplete"
				? t.signIn.social.incomplete
				: error
					? t.authErrors[error]
					: null,
	};
}
