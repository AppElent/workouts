import { convexErrorMessage } from "@foundry/core";
import { useCallback } from "react";
import { useMessages } from "#/lib/i18n";

/**
 * Explains a failed Convex call in the app's language: the catalog's message
 * for its code, else the server's text, else the caller's `fallback`.
 */
export function useConvexErrorMessage() {
	const { errors } = useMessages();
	return useCallback(
		(error: unknown, fallback: string) =>
			convexErrorMessage(error, errors, fallback),
		[errors],
	);
}
