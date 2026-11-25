import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "#/lib/auth/AuthCard";
import { AUTH_PATHS, safeRedirect } from "#/lib/auth/paths";
import { SignUpForm } from "#/lib/auth/SignUpForm";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/sign-up")({
	ssr: false,
	validateSearch: (
		search: Record<string, unknown>,
	): { redirect?: string; resume?: "social" } => ({
		redirect: safeRedirect(search.redirect),
		// Set by `/sso-callback` for a social sign-up that still needs a step.
		// Kept as the URL spells it: the router writes the validated search back
		// to the URL and validates it again, which would drop any other value.
		resume: search.resume === "social" ? "social" : undefined,
	}),
	component: SignUpPage,
});

function SignUpPage() {
	const navigate = useNavigate();
	const { redirect, resume } = Route.useSearch();
	const { auth } = useMessages();
	return (
		<AuthCard title={auth.signUp.title}>
			<SignUpForm
				redirect={redirect}
				resumeSocial={resume === "social"}
				// Drops the marker, so a reload does not resume the attempt.
				onStartOver={() =>
					navigate({ to: "/sign-up", search: { redirect }, replace: true })
				}
				onSuccess={() => navigate({ href: redirect ?? AUTH_PATHS.afterAuth })}
			/>
		</AuthCard>
	);
}
