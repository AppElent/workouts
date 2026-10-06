import * as Sentry from "@sentry/react";

const reported = new WeakSet<Error>();

/** Keep the original stack and avoid reporting the same caught error twice. */
export function reportError(error: unknown, operation: string) {
	if (error instanceof Error) {
		if (reported.has(error)) return;
		reported.add(error);
	}
	Sentry.captureException(
		error instanceof Error
			? error
			: new Error("Operation failed with a non-Error value"),
		{
			tags: { operation, handled: true },
		},
	);
	Sentry.logger.error("Web operation failed", { operation });
}
