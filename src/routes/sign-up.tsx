import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "#/lib/auth/AuthCard";
import { SignUpForm } from "#/lib/auth/SignUpForm";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/sign-up")({
	ssr: false,
	component: SignUpPage,
});

function SignUpPage() {
	const navigate = useNavigate();
	const { auth } = useMessages();
	return (
		<AuthCard title={auth.signUp.title}>
			<SignUpForm onSuccess={() => navigate({ to: "/dashboard" })} />
		</AuthCard>
	);
}
