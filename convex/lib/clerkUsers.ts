/**
 * Reads a Clerk user from the Backend API, the trusted source for which Apple
 * account is linked to a Foundry account. The client also knows, but a caller
 * could claim any Apple user ID, so server checks never take it from there.
 */

const CLERK_API = "https://api.clerk.com/v1";

type ClerkExternalAccount = {
	provider?: unknown;
	provider_user_id?: unknown;
	verification?: { status?: unknown } | null;
};

export class ClerkUnavailable extends Error {}

/**
 * The Apple user IDs (`sub`) linked to a Clerk user. Throws `ClerkUnavailable`
 * when `CLERK_SECRET_KEY` is not set, so callers fail closed.
 */
export async function linkedAppleUserIds(userId: string): Promise<string[]> {
	const secretKey = process.env.CLERK_SECRET_KEY;
	if (!secretKey) throw new ClerkUnavailable("CLERK_SECRET_KEY is not set");
	const response = await fetch(
		`${CLERK_API}/users/${encodeURIComponent(userId)}`,
		{
			headers: { Authorization: `Bearer ${secretKey}` },
			// A slow Clerk fails the revocation instead of holding the deletion.
			signal: AbortSignal.timeout(10_000),
		},
	);
	if (!response.ok) throw new Error(`Clerk /users returned ${response.status}`);
	const { external_accounts } = (await response.json()) as {
		external_accounts?: ClerkExternalAccount[];
	};
	return (external_accounts ?? [])
		.filter(
			(account) =>
				// The Backend API says `oauth_apple`; accept the bare name too.
				typeof account.provider === "string" &&
				account.provider.replace(/^oauth_/, "") === "apple" &&
				typeof account.provider_user_id === "string" &&
				account.provider_user_id !== "" &&
				// An unverified link never finished signing in with Apple.
				account.verification?.status === "verified",
		)
		.map((account) => account.provider_user_id as string);
}
