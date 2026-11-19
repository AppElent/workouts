import { AuthenticateWithRedirectCallback } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "#/lib/auth/AuthCard";
import { AUTH_PATHS, safeRedirect, withRedirect } from "#/lib/auth/paths";
import { useI18n } from "#/lib/i18n";

export const Route = createFileRoute("/sso-callback")({
	ssr: false,
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
		redirect: safeRedirect(search.redirect),
	}),
	component: SsoCallbackPage,
});

function SsoCallbackPage() {
	const { locale, messages } = useI18n();
	const { redirect } = Route.useSearch();
	const { auth } = messages;
	// A social sign-in Clerk transfers to a sign-up (or back) ends on these
	// fallbacks, so they carry the return path from `SocialButtons`.
	const afterAuth = redirect ?? AUTH_PATHS.afterAuth;
	return (
		<AuthCard title={auth.ssoCallback.title}>
			<AuthenticateWithRedirectCallback
				signInUrl={withRedirect(AUTH_PATHS.signIn, redirect)}
				signUpUrl={withRedirect(AUTH_PATHS.signUp, redirect)}
				signInFallbackRedirectUrl={afterAuth}
				signUpFallbackRedirectUrl={afterAuth}
			/>
			{/* A sign-in transferred to a sign-up may need Clerk's bot check. */}
			<div id="clerk-captcha" data-cl-language={locale} />
		</AuthCard>
	);
}
