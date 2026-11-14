import { AuthenticateWithRedirectCallback } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "#/lib/auth/AuthCard";
import { AUTH_PATHS } from "#/lib/auth/paths";
import { useI18n } from "#/lib/i18n";

export const Route = createFileRoute("/sso-callback")({
	ssr: false,
	component: SsoCallbackPage,
});

function SsoCallbackPage() {
	const { locale, messages } = useI18n();
	const { auth } = messages;
	return (
		<AuthCard title={auth.ssoCallback.title}>
			<AuthenticateWithRedirectCallback
				signInUrl={AUTH_PATHS.signIn}
				signUpUrl={AUTH_PATHS.signUp}
				signInFallbackRedirectUrl={AUTH_PATHS.afterAuth}
				signUpFallbackRedirectUrl={AUTH_PATHS.afterAuth}
			/>
			{/* A sign-in transferred to a sign-up may need Clerk's bot check. */}
			<div id="clerk-captcha" data-cl-language={locale} />
		</AuthCard>
	);
}
