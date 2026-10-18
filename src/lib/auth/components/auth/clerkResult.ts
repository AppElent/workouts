/**
 * Clerk Core 3 resource methods resolve to `{ error }` instead of throwing.
 * Rethrowing keeps each form's single try/catch the one error path, and the
 * error (a `ClerkAPIResponseError` with `errors[]`) still reads through
 * `clerkErrorMessage`.
 */
export async function orThrow(
	pending: Promise<{ error: unknown }>,
): Promise<void> {
	const { error } = await pending;
	if (error) {
		throw error;
	}
}
