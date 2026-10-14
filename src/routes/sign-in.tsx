import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthCard, SignInForm } from "#/lib/auth";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/sign-in")({
	ssr: false,
	component: SignInPage,
});

function SignInPage() {
	const navigate = useNavigate();
	const { isSignedIn } = useAuth();
	const { auth } = useMessages();

	useEffect(() => {
		if (isSignedIn) {
			navigate({ to: "/dashboard" });
		}
	}, [isSignedIn, navigate]);

	return (
		<AuthCard title={auth.signIn.title} subtitle={auth.signIn.subtitle}>
			<SignInForm onSuccess={() => navigate({ to: "/dashboard" })} />
		</AuthCard>
	);
}
