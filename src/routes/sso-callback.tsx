import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthCard, useAuthConfig } from "#/lib/auth";

export const Route = createFileRoute("/sso-callback")({
	ssr: false,
	component: SsoCallbackPage,
});

function SsoCallbackPage() {
	const { paths } = useAuthConfig();
	return (
		<AuthCard title="Signing you in…">
			<AuthenticateWithRedirectCallback
				signInUrl={paths.signIn}
				signUpUrl={paths.signUp}
				signInFallbackRedirectUrl={paths.afterAuth}
				signUpFallbackRedirectUrl={paths.afterAuth}
			/>
			{/* A sign-in transferred to a sign-up may need Clerk's bot check. */}
			<div id="clerk-captcha" />
		</AuthCard>
	);
}
