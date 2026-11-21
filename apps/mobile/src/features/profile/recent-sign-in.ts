/**
 * Clerk deletes an account only after a recent sign-in ("strict": the
 * strongest factor within 10 minutes). Clerk's verify dialog is web-only
 * (`@clerk/expo` 4.14 opens `__internal_openReverification`, which the app
 * lacks), so the app checks first and, when the sign-in is old, stops before
 * anything is deleted and asks the person to sign in again: the app's own
 * sign-in (password, emailed code, Apple or Google) gives a fresh one.
 * Arcade Club does the same (AppElent/games#93).
 *
 * `checkAuthorization` reads the session's factor ages: a session without a
 * second factor (a social sign-in Clerk let through without one) counts its
 * first factor, also for a two-step account. On dev Clerk the server accepted
 * `user.delete()` from such sessions and from ones past the window, so this
 * check is the stricter side (APP-528, profile contract).
 */

/** Half Clerk's window, so it doesn't lapse while the data is deleted. */
const RECENT_SIGN_IN = { level: "second_factor", afterMinutes: 5 } as const;

/** The slice of `useClerk()` the check reads. */
export type LiveClerk = {
	readonly session?: {
		reload(): Promise<unknown>;
		checkAuthorization(params: {
			reverification: typeof RECENT_SIGN_IN;
		}): boolean;
	} | null;
};

/**
 * Whether the live session signed in recently enough to delete the account.
 * The sign-in age is only as fresh as the last session reload, so reload
 * first; a reload failure (offline) throws.
 */
export async function hasRecentSignIn(clerk: LiveClerk): Promise<boolean> {
	await clerk.session?.reload();
	return (
		clerk.session?.checkAuthorization({ reverification: RECENT_SIGN_IN }) ??
		false
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Whether Clerk refused for want of a recent sign-in: its reverification
 * hint, or its API error `session_reverification_required`.
 */
export function isRecentSignInRefusal(value: unknown, depth = 0): boolean {
	if (!isRecord(value) || depth > 4) return false;
	if (isRecord(value.clerk_error))
		return value.clerk_error.reason === "reverification-error";
	if (value.code === "session_reverification_required") return true;
	return (
		Array.isArray(value.errors) &&
		value.errors.some((nested) => isRecentSignInRefusal(nested, depth + 1))
	);
}
