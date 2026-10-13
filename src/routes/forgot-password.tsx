import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard, ForgotPasswordForm } from "#/lib/auth";

export const Route = createFileRoute("/forgot-password")({
	ssr: false,
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const navigate = useNavigate();
	return (
		<AuthCard title="Reset your password">
			<ForgotPasswordForm onSuccess={() => navigate({ to: "/dashboard" })} />
		</AuthCard>
	);
}
