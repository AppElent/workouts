import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "#/lib/auth/AuthCard";
import { ForgotPasswordForm } from "#/lib/auth/ForgotPasswordForm";
import { AUTH_PATHS, safeRedirect, withRedirect } from "#/lib/auth/paths";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/forgot-password")({
	ssr: false,
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
		redirect: safeRedirect(search.redirect),
	}),
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const navigate = useNavigate();
	const { redirect } = Route.useSearch();
	const { auth } = useMessages();
	return (
		<AuthCard title={auth.forgotPassword.title}>
			<ForgotPasswordForm
				onSuccess={() => navigate({ href: redirect ?? AUTH_PATHS.afterAuth })}
				onBackToSignIn={() =>
					navigate({ href: withRedirect(AUTH_PATHS.signIn, redirect) })
				}
			/>
		</AuthCard>
	);
}
