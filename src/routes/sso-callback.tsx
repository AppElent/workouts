import { HandleSSOCallback, useAuth } from "@clerk/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
	const { messages } = useI18n();
	const { redirect } = Route.useSearch();
	const { isLoaded } = useAuth();
	// Latched: `isLoaded` drops again while Clerk activates the finished session
	// and leaves the page, which is not a Clerk that still has to load.
	const [hasLoaded, setHasLoaded] = useState(isLoaded);
	if (isLoaded && !hasLoaded) setHasLoaded(true);
	const activating = hasLoaded && !isLoaded;
	const navigate = useNavigate();
	const { auth } = messages;
	// In-app, so `SignUpForm` still sees the open attempt's `errors`. Clerk's
	// `decorateUrl` may hand back an absolute URL that has to load in full.
	const go = (url: string) => {
		if (/^https?:/.test(url)) window.location.assign(url);
		else navigate({ href: url, replace: true });
	};
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
			{activating ? (
				// Signed in: only the redirect is left, however long that takes.
				<p className="text-center text-sm text-text-muted" role="status">
					{auth.wait}
				</p>
			) : (
				<ResumePending
					// The callback gets its own time. Clerk swallows its errors, so one
					// that failed shows up only as one that never leaves this page.
					key={hasLoaded ? "callback" : "load"}
					backLabel={auth.secondFactor.backToSignIn}
					onBack={() => {
						// Once Clerk has loaded its callback below runs, and unmounting
						// does not stop it: only a page load keeps it from finishing this
						// sign-in under the one the person starts next.
						if (hasLoaded) {
							window.location.replace(
								withRedirect(AUTH_PATHS.signIn, redirect),
							);
							return;
						}
						navigate({
							to: "/sign-in",
							search: { redirect },
							state: { focusSignIn: true },
							replace: true,
						});
					}}
				/>
			)}
			{/*
			 * Finishes the social sign-in or sign-up, transferring between the two
			 * when Clerk asks. A suspicious sign-up gets Clerk's bot challenge in a
			 * dialog first; one that fails it goes to `navigateToSignUp` with the
			 * reason on `errors.global`, which `SignUpForm` shows (APP-125).
			 */}
			<HandleSSOCallback
				navigateToApp={({ decorateUrl }) => go(decorateUrl(afterAuth))}
				// A second factor, or `needs_client_trust`: `SignInForm` picks up the
				// open attempt.
				navigateToSignIn={() => go(signInUrl)}
				// Missing or unverified fields: `SignUpForm` picks up the open attempt.
				navigateToSignUp={() => go(continueSignUpUrl)}
			/>
		</AuthCard>
	);
}

function withResume(url: string) {
	return `${url}${url.includes("?") ? "&" : "?"}resume=social`;
}
