import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard, SignUpForm } from "#/lib/auth";
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
