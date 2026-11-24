import { useAuth } from "@clerk/react";
import {
	createFileRoute,
	useLocation,
	useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthCard } from "#/lib/auth/AuthCard";
import { AUTH_PATHS, safeRedirect } from "#/lib/auth/paths";
import { SignInForm } from "#/lib/auth/SignInForm";
import { useMessages } from "#/lib/i18n";

declare module "@tanstack/react-router" {
	interface HistoryState {
		/** Set by the way back from `/sso-callback`. */
		focusSignIn?: boolean;
	}
}

export const Route = createFileRoute("/sign-in")({
	ssr: false,
	validateSearch: (
		search: Record<string, unknown>,
	): { redirect?: string; resume?: "social" } => ({
		redirect: safeRedirect(search.redirect),
		// Set by `/sso-callback` for a social sign-in that still needs a step.
		// Kept as the URL spells it: the router writes the validated search back
		// to the URL and validates it again, which would drop any other value.
		resume: search.resume === "social" ? "social" : undefined,
	}),
	component: SignInPage,
});

function SignInPage() {
	const navigate = useNavigate();
	const { redirect, resume } = Route.useSearch();
	const focusFirst = useLocation({
		select: ({ state }) => state.focusSignIn === true,
	});
	const { isSignedIn } = useAuth();
	const { auth } = useMessages();

	useEffect(() => {
		if (isSignedIn) {
			navigate({ href: redirect ?? AUTH_PATHS.afterAuth });
		}
	}, [isSignedIn, navigate, redirect]);

	return (
		<AuthCard title={auth.signIn.title} subtitle={auth.signIn.subtitle}>
			<SignInForm
				redirect={redirect}
				resumeSocial={resume === "social"}
				focusFirst={focusFirst}
				// Drops the marker, so a reload does not resume the attempt.
				onStartOver={() => {
					if (!resume) return;
					navigate({ to: "/sign-in", search: { redirect }, replace: true });
				}}
				onSuccess={() => navigate({ href: redirect ?? AUTH_PATHS.afterAuth })}
			/>
		</AuthCard>
	);
}
