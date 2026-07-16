import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "#/components/ui/button";
import { EmptyState } from "#/components/ui/empty-state";

/**
 * Default route-level error boundary: explains the failure and offers a
 * retry instead of a white screen. `reset` clears the boundary;
 * `router.invalidate()` re-runs loaders so the retry actually refetches.
 */
export function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	return (
		<div className="mx-auto max-w-md p-6">
			<EmptyState
				icon={AlertTriangle}
				title="Something went wrong"
				description={
					error instanceof Error && error.message
						? error.message
						: "An unexpected error occurred."
				}
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
