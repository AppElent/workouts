import { ConvexError } from "convex/values";

/**
 * Extract a short, human-readable message from an error thrown by a Convex
 * function call. Server code throws `ConvexError(message)` for user-facing
 * validation failures; its payload is delivered verbatim (even in production).
 * Plain errors arrive wrapped like:
 *   "[CONVEX M(foo:bar)] [Request ID: ...] Server Error Uncaught Error: <msg>
 *    at handler (../convex/foo.ts:1:2)"
 * so we strip that wrapper and fall back to a caller-supplied default.
 */
export function getConvexErrorMessage(
	error: unknown,
	fallback: string,
): string {
	if (error instanceof ConvexError) {
		const data: unknown = error.data;
		if (typeof data === "string" && data.trim()) return data.trim();
		if (
			data &&
			typeof data === "object" &&
			"message" in data &&
			typeof (data as { message: unknown }).message === "string"
		) {
			return (data as { message: string }).message;
		}
		return fallback;
	}
	if (error instanceof Error) {
		const match = error.message.match(
			/Uncaught (?:Convex)?Error:\s*(.+?)(?:\s+at\s|\s+Called by client|$)/s,
		);
		if (match?.[1]?.trim()) return match[1].trim();
		return fallback;
	}
	return fallback;
}
