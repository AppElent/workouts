import { useSignIn } from "@clerk/clerk-react";
import { useState } from "react";
import { fmt, useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { useAuthConfig } from "./AuthConfigProvider";
import { AuthError } from "./AuthError";
import { clerkErrorMessage } from "./types";

/**
 * One button per configured social provider. Each redirects to the provider
 * and back to `paths.ssoCallback`, where `AuthenticateWithRedirectCallback`
 * finishes the flow. Starting from sign-in is enough for sign-up too: Clerk
 * transfers an unknown account to a sign-up on the callback.
 */
export function SocialButtons() {
	const { isLoaded, signIn } = useSignIn();
	const config = useAuthConfig();
	const { auth } = useMessages();
	const [pending, setPending] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	if (config.socialProviders.length === 0) {
		return null;
	}

	async function start(id: string, strategy: `oauth_${string}`) {
		if (!isLoaded) {
			return;
		}
		setError(null);
		setPending(id);
		try {
			await signIn.authenticateWithRedirect({
				// Clerk's strategy union is narrower than our config type.
				strategy: strategy as Parameters<
					typeof signIn.authenticateWithRedirect
				>[0]["strategy"],
				redirectUrl: config.paths.ssoCallback,
				redirectUrlComplete: config.paths.afterAuth,
			});
		} catch (err) {
			setError(clerkErrorMessage(err));
			setPending(null);
		}
	}

	return (
		<div className="flex flex-col gap-2">
			<AuthError message={error} />
			{config.socialProviders.map((provider) => (
				<AuthButton
					key={provider.id}
					type="button"
					variant="ghost"
					className="border-solid border-[var(--auth-border)]"
					loading={pending === provider.id}
					disabled={pending !== null}
					onClick={() => start(provider.id, provider.strategy)}
				>
					{fmt(auth.continueWith, { provider: provider.label })}
				</AuthButton>
			))}
			<div className="my-1 flex items-center gap-3 text-xs text-[var(--auth-muted)]">
				<span className="h-px flex-1 bg-[var(--auth-border)]" />
				{auth.or}
				<span className="h-px flex-1 bg-[var(--auth-border)]" />
			</div>
		</div>
	);
}
