import { parseConvexError } from "@foundry/core";

/** The human part of a failed Convex call, or `fallback` when there is none. */
export function getConvexErrorMessage(
	error: unknown,
	fallback: string,
): string {
	return parseConvexError(error).message || fallback;
}
