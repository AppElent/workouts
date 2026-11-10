import { clerkErrorMessageKey } from "@foundry/core";
import { useMessages } from "#/lib/i18n";

/**
 * Clerk Core 3 resource methods resolve to `{ error }` instead of throwing.
 * Rethrowing keeps each form's single try/catch the one error path.
 */
export async function orThrow(
	pending: Promise<{ error: unknown }>,
): Promise<void> {
	const { error } = await pending;
	if (error) throw error;
}

type ClerkErrorShape = {
	errors?: { longMessage?: string; message?: string }[];
};

/**
 * Translates a Clerk error by its code. An unmapped code keeps Clerk's own
 * (English) text, which says more than the generic message.
 */
export function useClerkErrorMessage(): (error: unknown) => string {
	const { auth } = useMessages();
	return (error) => {
		const key = clerkErrorMessageKey(error);
		if (key !== "generic") return auth.errors[key];
		const first = (error as ClerkErrorShape | null)?.errors?.[0];
		return first?.longMessage ?? first?.message ?? auth.errors.generic;
	};
}
