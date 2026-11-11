import { AuthenticateWithRedirectCallback } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "#/lib/auth/AuthCard";
import { AUTH_PATHS } from "#/lib/auth/paths";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/sso-callback")({
	ssr: false,
	component: SsoCallbackPage,
});

function SsoCallbackPage() {
	const { auth } = useMessages();
	return (
		<AuthCard title={auth.ssoCallback.title}>
			<AuthenticateWithRedirectCallback
				signInUrl={AUTH_PATHS.signIn}
				signUpUrl={AUTH_PATHS.signUp}
				signInFallbackRedirectUrl={AUTH_PATHS.afterAuth}
				signUpFallbackRedirectUrl={AUTH_PATHS.afterAuth}
			/>
			{/* A sign-in transferred to a sign-up may need Clerk's bot check. */}
			<div id="clerk-captcha" />
		</AuthCard>
	);
}
