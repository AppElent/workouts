import type { Auth, UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";

const READ_SCOPE = "foundry:read";
const WRITE_SCOPE = "foundry:write";

/**
 * Scopes of a Clerk OAuth token (MCP clients and other connected apps), or
 * null for the app's own session token. OAuth tokens carry `client_id`.
 * Convex accepts these tokens directly (see auth.config.ts), so the MCP
 * endpoint's read/write scopes are enforced here too.
 */
function connectedAppScopes(identity: UserIdentity): Set<string> | null {
	if (typeof identity.client_id !== "string") return null;
	const scope = typeof identity.scope === "string" ? identity.scope : "";
	return new Set(scope.split(" ").filter(Boolean));
}

/**
 * The signed-in identity. A connected app needs a Foundry scope; without
 * `foundry:write` it may only read: any context that can write (mutations,
 * actions) rejects it. Errors carry an app code plus English text, which the
 * MCP endpoint shows to the agent.
 */
export async function getIdentity(ctx: {
	auth: Auth;
}): Promise<UserIdentity | null> {
	const identity = await ctx.auth.getUserIdentity();
	const scopes = identity && connectedAppScopes(identity);
	if (!scopes) return identity;
	if (!scopes.has(READ_SCOPE) && !scopes.has(WRITE_SCOPE))
		throw new ConvexError({
			code: "unauthenticated",
			message: "This connected app has no access to Foundry.",
		});
	if ("runMutation" in ctx && !scopes.has(WRITE_SCOPE))
		throw new ConvexError({
			code: "readOnly",
			message: "This connected app has read-only access to Foundry.",
		});
	return identity;
}

/** Account-wide wipes stay in the Foundry app; connected apps may not run them. */
export async function rejectConnectedApps(ctx: { auth: Auth }) {
	const identity = await ctx.auth.getUserIdentity();
	if (identity && connectedAppScopes(identity))
		throw new ConvexError({
			code: "readOnly",
			message: "Connected apps cannot reset or delete a Foundry account.",
		});
}
