import { useAuth, useClerk } from "@clerk/react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { EmptyState } from "#/components/ui/empty-state";
import { useMessages } from "#/lib/i18n";
import { AUTH_PATHS, safeRedirect, withRedirect } from "./paths";
import { useStalled } from "./stall";

export type SessionState = "pending" | "signedOut" | "ready";

/**
 * Where a signed-in page stands. Clerk decides navigation and Convex decides
 * data: a page renders only once Convex has confirmed the token, and only a
 * Clerk sign-out sends the person to sign-in. Clerk signed in while Convex has
 * not confirmed is pending: the token is still being checked, or the session
 * ended elsewhere and Clerk has not noticed yet.
 */
export function sessionState(auth: {
	clerkLoaded: boolean;
	clerkSignedIn: boolean;
	convexAuthenticated: boolean;
}): SessionState {
	if (!auth.clerkLoaded) return "pending";
	if (!auth.clerkSignedIn) return "signedOut";
	return auth.convexAuthenticated ? "ready" : "pending";
}

function useSessionState() {
	const { isLoaded, isSignedIn } = useAuth();
	const { isAuthenticated } = useConvexAuth();
	return sessionState({
		clerkLoaded: isLoaded,
		clerkSignedIn: isSignedIn === true,
		convexAuthenticated: isAuthenticated,
	});
}

/** Mounts its children only while the session is ready for protected data. */
export function SignedInGate({ children }: { children: React.ReactNode }) {
	const state = useSessionState();
	if (state === "signedOut") return <SignInRedirect />;
	if (state === "pending")
		return <SessionPending onRetry={() => window.location.reload()} />;
	return children;
}

/**
 * The error boundary's answer to an `unauthenticated` query: sign-in when the
 * session is gone, else wait for Convex to confirm it again and retry. A
 * session that stays ready the whole time is not waited on forever: the stall
 * controls appear like anywhere else.
 */
export function SessionLost({ onRecovered }: { onRecovered: () => void }) {
	const state = useSessionState();
	const [waited, setWaited] = useState(false);
	useEffect(() => {
		if (state === "pending") setWaited(true);
		else if (state === "ready" && waited) onRecovered();
	}, [state, waited, onRecovered]);
	if (state === "signedOut") return <SignInRedirect />;
	return <SessionPending onRetry={onRecovered} />;
}

/**
 * Sign-in, returning to this page afterwards. The page is read once: while the
 * navigation is pending, the location already reads as sign-in.
 */
function SignInRedirect() {
	const navigate = useNavigate();
	const { href } = useLocation();
	const [redirect] = useState(() => safeRedirect(href));
	useEffect(() => {
		void navigate({
			to: AUTH_PATHS.signIn,
			search: { redirect },
			replace: true,
		});
	}, [navigate, redirect]);
	return null;
}

function SessionPending({ onRetry }: { onRetry: () => void }) {
	const { auth } = useMessages();
	const clerk = useClerk();
	const { href } = useLocation();
	const stalled = useStalled();

	if (!stalled) {
		return (
			<div role="status" className="p-6 text-sm text-text-muted">
				{auth.session.checking}
			</div>
		);
	}
	const signIn = withRedirect(AUTH_PATHS.signIn, safeRedirect(href));
	return (
		<div className="mx-auto max-w-md p-6">
			<EmptyState
				icon={Clock}
				title={auth.session.stalled}
				description={auth.session.stalledHelp}
				action={
					<div className="flex flex-wrap justify-center gap-2">
						<Button variant="outline" onClick={onRetry}>
							{auth.session.retry}
						</Button>
						<Button
							onClick={() => {
								clerk
									.signOut({ redirectUrl: signIn })
									.catch(() => window.location.assign(signIn));
							}}
						>
							{auth.session.signInAgain}
						</Button>
					</div>
				}
			/>
		</div>
	);
}
