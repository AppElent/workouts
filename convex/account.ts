import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import {
	appleCredentials,
	isAppleClientId,
	revokeAppleAuthorization,
} from "./lib/appleSignIn";
import { getOptionalUserId, requireSubject, requireUserId } from "./lib/auth";
import { rejectConnectedApps } from "./lib/connectedApps";
import { appError } from "./lib/errors";
import {
	personalDataBlockerValidator as blocker,
	deletePersonalData,
	personalDataBlocker,
} from "./lib/personalData";

/** Why deleting this account's personal data is currently unsafe, if at all. */
export const deletionBlocker = query({
	args: {},
	returns: blocker,
	handler: async (ctx) => {
		const userId = await getOptionalUserId(ctx);
		return userId ? await personalDataBlocker(ctx, userId) : null;
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
		await rejectConnectedApps(ctx);
		const userId = await requireSubject(ctx, expectedSubject);
		const reason = await personalDataBlocker(ctx, userId);
		if (reason) throw appError(reason);
		return {
			done: await deletePersonalData(ctx, userId, {
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
 * with the bundle ID of the build that showed it. Failures are one stable
 * code; callers still delete the account.
 */
export const revokeAppleSignIn = action({
	args: { authorizationCode: v.string(), bundleId: v.string() },
	returns: v.null(),
	handler: async (ctx, { authorizationCode, bundleId }) => {
		await requireUserId(ctx);
		if (!authorizationCode || authorizationCode.length > MAX_AUTHORIZATION_CODE)
			throw appError("invalid", "authorizationCode");
		if (!isAppleClientId(bundleId)) throw appError("invalid", "bundleId");
		const credentials = appleCredentials();
		if (!credentials) throw appError("unavailable");
		try {
			await revokeAppleAuthorization(credentials, authorizationCode, bundleId);
		} catch (error) {
			console.error("account.revokeAppleSignIn failed", error);
			throw appError("failed");
		}
		return null;
	},
});
