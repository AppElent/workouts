import { convexErrorMessage } from "@foundry/core";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "#/components/ui/button";
import { EmptyState } from "#/components/ui/empty-state";
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
 */
export function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
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
					<Button
						variant="outline"
						onClick={() => {
							reset();
							void router.invalidate();
						}}
					>
						Try again
					</Button>
				}
			/>
		</div>
	);
}
