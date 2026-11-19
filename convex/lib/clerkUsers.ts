/**
 * Reads Clerk user objects as webhooks (and the one-off backfill) deliver
 * them. They are the trusted source for which Apple account is linked to an
 * AppElent login: the client also knows, but a caller could claim any Apple
 * user ID, so server checks never take it from there.
 */

type ClerkExternalAccount = {
	provider?: unknown;
	provider_user_id?: unknown;
	verification?: { status?: unknown } | null;
};

/** The verified Sign in with Apple users (`sub`) of a Clerk user object. */
export function verifiedAppleUserIds(user: {
	external_accounts?: unknown;
}): string[] {
	const accounts = Array.isArray(user.external_accounts)
		? (user.external_accounts as ClerkExternalAccount[])
		: [];
	const ids = accounts
		.filter(
			(account) =>
				typeof account === "object" &&
				account !== null &&
				// Clerk says `oauth_apple`; accept the bare name too.
				typeof account.provider === "string" &&
				account.provider.replace(/^oauth_/, "") === "apple" &&
				typeof account.provider_user_id === "string" &&
				account.provider_user_id !== "" &&
				// An unverified link never finished signing in with Apple.
				account.verification?.status === "verified",
		)
		.map((account) => account.provider_user_id as string);
	return [...new Set(ids)];
}
