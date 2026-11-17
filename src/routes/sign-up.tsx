import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "#/lib/auth/AuthCard";
import { AUTH_PATHS, safeRedirect } from "#/lib/auth/paths";
import { SignUpForm } from "#/lib/auth/SignUpForm";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/sign-up")({
	ssr: false,
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
		redirect: safeRedirect(search.redirect),
	}),
	component: SignUpPage,
});

function SignUpPage() {
	const navigate = useNavigate();
	const { redirect } = Route.useSearch();
	const { auth } = useMessages();
	return (
		<AuthCard title={auth.signUp.title}>
			<SignUpForm
				redirect={redirect}
				onSuccess={() => navigate({ href: redirect ?? AUTH_PATHS.afterAuth })}
			/>
		</AuthCard>
	);
}
