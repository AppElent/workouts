import { ConvexError, v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import {
	APPLE_CLIENT_IDS,
	appleCredentials,
	isAppleClientId,
	revokeAppleAuthorization,
} from "./lib/appleSignIn";
import {
	deletePersonalData,
	personalDataBlocker,
} from "./lib/personalData";

const blocker = v.union(
	v.literal("activeActivity"),
	v.literal("hostedWorkout"),
	v.null(),
);

/** Why deleting this account's personal data is currently unsafe, if at all. */
export const deletionBlocker = query({
	args: {},
	returns: blocker,
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		return identity ? await personalDataBlocker(ctx, identity.subject) : null;
	},
});

/**
 * Deletes one bounded batch of the signed-in account's personal training and
 * nutrition data, including stored Food photos. Callers repeat until `done`;
 * an interrupted run resumes where it stopped. Shipped catalogs are untouched.
 */
export const deleteData = mutation({
	args: { expectedSubject: v.string() },
	returns: v.object({ done: v.boolean() }),
	handler: async (ctx, { expectedSubject }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new ConvexError("unauthenticated");
		if (identity.subject !== expectedSubject)
			throw new ConvexError("accountChanged");
		const reason = await personalDataBlocker(ctx, identity.subject);
		if (reason) throw new ConvexError(reason);
		return {
			done: await deletePersonalData(ctx, identity.subject, {
				budget: 2000,
				keepPreferences: false,
			}),
		};
	},
});

/** Apple authorization codes are opaque strings of a few hundred characters. */
const MAX_AUTHORIZATION_CODE = 2000;

/**
 * Revokes the signed-in account's Sign in with Apple grant before the account
 * is deleted. The code comes from a fresh native Apple sheet on iOS, together
 * with the bundle ID of the build that showed it; builds from before install
 * variants send none and are production. Failures are one stable code;
 * callers still delete the account.
 */
export const revokeAppleSignIn = action({
	args: { authorizationCode: v.string(), bundleId: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, { authorizationCode, bundleId = APPLE_CLIENT_IDS[0] }) => {
		if (!(await ctx.auth.getUserIdentity()))
			throw new ConvexError("unauthenticated");
		if (
			!authorizationCode ||
			authorizationCode.length > MAX_AUTHORIZATION_CODE ||
			!isAppleClientId(bundleId)
		)
			throw new ConvexError("invalid");
		const credentials = appleCredentials();
		if (!credentials) throw new ConvexError("unavailable");
		try {
			await revokeAppleAuthorization(credentials, authorizationCode, bundleId);
		} catch (error) {
			console.error("account.revokeAppleSignIn failed", error);
			throw new ConvexError("failed");
		}
		return null;
	},
});
