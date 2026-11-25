import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "#/lib/auth/AuthCard";
import { AUTH_PATHS, safeRedirect, withRedirect } from "#/lib/auth/paths";
import { ResumePending } from "#/lib/auth/ResumePending";
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
	const { isLoaded } = useAuth();
	const navigate = useNavigate();
	const { auth } = messages;
	// A social sign-in Clerk transfers to a sign-up (or back) ends on these
	// fallbacks, so they carry the return path from `SocialButtons`.
	const afterAuth = redirect ?? AUTH_PATHS.afterAuth;
	// Marked so `SignInForm` and `SignUpForm` carry on with the attempt only when
	// it comes from here, not for whoever opens the page later in this browser.
	const signInUrl = withResume(withRedirect(AUTH_PATHS.signIn, redirect));
	const continueSignUpUrl = withResume(
		withRedirect(AUTH_PATHS.signUp, redirect),
	);
	return (
		<AuthCard title={auth.ssoCallback.title}>
			{isLoaded ? null : (
				<ResumePending
					backLabel={auth.secondFactor.backToSignIn}
					// Safe without a page load: Clerk's callback below only mounts, and
					// so only runs, once Clerk has loaded.
					onBack={() =>
						navigate({
							to: "/sign-in",
							search: { redirect },
							state: { focusSignIn: true },
							replace: true,
						})
					}
				/>
			)}
			<AuthenticateWithRedirectCallback
				signInUrl={signInUrl}
				signUpUrl={withRedirect(AUTH_PATHS.signUp, redirect)}
				signInFallbackRedirectUrl={afterAuth}
				signUpFallbackRedirectUrl={afterAuth}
				// Clerk's default is its own `#/factor-two` hash route, which
				// `SignInForm` does not read; it picks up the open attempt instead.
				// `needs_client_trust` has no URL of its own and lands on `signInUrl`.
				secondFactorUrl={signInUrl}
				// Likewise for a sign-up with missing or unverified fields, instead of
				// `#/continue`, `#/verify-email-address` and `#/verify-phone-number`.
				continueSignUpUrl={continueSignUpUrl}
				verifyEmailAddressUrl={continueSignUpUrl}
				verifyPhoneNumberUrl={continueSignUpUrl}
			/>
			{/* A sign-in transferred to a sign-up may need Clerk's bot check. */}
			<div id="clerk-captcha" data-cl-language={locale} />
		</AuthCard>
	);
}

function withResume(url: string) {
	return `${url}${url.includes("?") ? "&" : "?"}resume=social`;
}
