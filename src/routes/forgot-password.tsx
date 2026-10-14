import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard, ForgotPasswordForm } from "#/lib/auth";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/forgot-password")({
	ssr: false,
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const navigate = useNavigate();
	const { auth } = useMessages();
	return (
		<AuthCard title={auth.forgotPassword.title}>
			<ForgotPasswordForm onSuccess={() => navigate({ to: "/dashboard" })} />
		</AuthCard>
	);
}
