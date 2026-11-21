import { convexErrorMessage, parseConvexError } from "@foundry/core";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Button } from "#/components/ui/button";
import { EmptyState } from "#/components/ui/empty-state";
import { SessionLost } from "#/lib/auth/SessionGate";
import { errors } from "#/lib/i18n/messages/en/errors";
import { reportError } from "#/lib/observability/errors";

/**
 * `reset` clears the boundary; `router.invalidate()` re-runs loaders so the
 * retry actually refetches.
 *
 * Deliberately not localized: as the router's `defaultErrorComponent` it can
 * render in place of the root route itself (e.g. a provider throwing during
 * initial render), outside the `LocaleProvider` that `RootLayout` mounts, where
 * `useMessages()` would turn a recoverable error into a second crash.
 *
 * An `unauthenticated` error is a session that ended or is being re-checked,
 * not a failure: it goes to sign-in or waits and retries instead. Only Convex
 * queries raise it, and they run below the root layout's providers.
 */
export function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	const retry = useCallback(() => {
		reset();
		void router.invalidate();
	}, [reset, router]);
	if (parseConvexError(error).code === "unauthenticated") {
		return <SessionLost onRecovered={retry} />;
	}
	return <ErrorCard error={error} retry={retry} />;
}

function ErrorCard({ error, retry }: { error: unknown; retry: () => void }) {
	const router = useRouter();
	if (router.isServer) reportError(error, "route.render");
	useEffect(() => reportError(error, "route.render"), [error]);
	return (
		<div className="mx-auto max-w-md p-6">
			<EmptyState
				icon={AlertTriangle}
				title="Something went wrong"
				description={convexErrorMessage(
					error,
					errors,
					"An unexpected error occurred.",
				)}
				action={
					<Button variant="outline" onClick={retry}>
						Try again
					</Button>
				}
			/>
		</div>
	);
}
