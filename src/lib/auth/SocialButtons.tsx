import { useSignIn } from "@clerk/react";
import {
	type SocialSignInProvider,
	socialSignInProviders,
} from "@foundry/core";
import { useState } from "react";
import { fmt, useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { orThrow, useClerkErrorMessage } from "./clerkError";
import { AUTH_PATHS } from "./paths";

const SOCIAL_PROVIDERS = [
	{ id: "google", label: "Google", strategy: "oauth_google" },
	{ id: "microsoft", label: "Microsoft", strategy: "oauth_microsoft" },
	{ id: "apple", label: "Apple", strategy: "oauth_apple" },
] as const satisfies readonly {
	id: SocialSignInProvider;
	label: string;
	strategy: `oauth_${SocialSignInProvider}`;
}[];

/**
 * One button per social provider. Each redirects to the provider and back to
 * the SSO callback route, where `AuthenticateWithRedirectCallback` finishes
 * the flow. Starting from sign-in is enough for sign-up too: Clerk transfers
 * an unknown account to a sign-up on the callback.
 */
export function SocialButtons() {
	const { signIn } = useSignIn();
	const { auth } = useMessages();
	const errorMessage = useClerkErrorMessage();
	const [pending, setPending] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const available = socialSignInProviders(
		import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
	);

	async function start(
		strategy: (typeof SOCIAL_PROVIDERS)[number]["strategy"],
	) {
		setError(null);
		setPending(strategy);
		try {
			await orThrow(
				signIn.sso({
					strategy,
					redirectCallbackUrl: AUTH_PATHS.ssoCallback,
					redirectUrl: AUTH_PATHS.afterAuth,
				}),
			);
		} catch (err) {
			setError(errorMessage(err));
			setPending(null);
		}
	}

	return (
		<div className="flex flex-col gap-2">
			<AuthError message={error} />
			{SOCIAL_PROVIDERS.filter((p) => available.includes(p.id)).map(
				(provider) => (
					<AuthButton
						key={provider.strategy}
						type="button"
						variant="ghost"
						className="border-solid border-[var(--auth-border)]"
						loading={pending === provider.strategy}
						disabled={pending !== null}
						onClick={() => start(provider.strategy)}
					>
						{fmt(auth.continueWith, { provider: provider.label })}
					</AuthButton>
				),
			)}
			<div className="my-1 flex items-center gap-3 text-xs text-[var(--auth-muted)]">
				<span className="h-px flex-1 bg-[var(--auth-border)]" />
				{auth.or}
				<span className="h-px flex-1 bg-[var(--auth-border)]" />
			</div>
		</div>
	);
}
