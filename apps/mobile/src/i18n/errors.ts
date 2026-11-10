import { parseConvexError } from "@foundry/core";

/** The human part of a failed Convex call, or `fallback` (from the catalog) when there is none. */
export function convexErrorMessage(error: unknown, fallback: string): string {
	return parseConvexError(error).message || fallback;
}
