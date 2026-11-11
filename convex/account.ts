import { ConvexError, v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import {
	APPLE_CLIENT_IDS,
	appleCredentials,
	isAppleClientId,
	revokeAppleAuthorization,
} from "./lib/appleSignIn";
import { getIdentity, rejectConnectedApps } from "./lib/connectedApps";
import { deletePersonalData, personalDataBlocker } from "./lib/personalData";

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
		const identity = await getIdentity(ctx);
		return identity ? await personalDataBlocker(ctx, identity.subject) : null;
	},
});

/**
 * Whether the signed-in account is new: never saved Nutrition Goals and no history
 * (Diary Entries, Strength Sessions, Activities, or WOD results). Mobile
 * offers its first-run only then. One indexed `first()` per table, so the cost
 * stays constant as history grows. Signed out, or a connected app without a
 * Foundry scope, answers "not empty" instead of failing: nothing is offered.
 */
export const firstRun = query({
	args: {},
	returns: v.object({ empty: v.boolean() }),
	handler: async (ctx) => {
		const identity = await getIdentity(ctx).catch((error: unknown) => {
			if (error instanceof ConvexError) return null;
			throw error;
		});
		if (!identity) return { empty: false };
		const userId = identity.subject;
		const found = await Promise.all([
			ctx.db
				.query("nutritionGoalVersions")
				.withIndex("by_user_effectiveFrom", (q) => q.eq("userId", userId))
				.first(),
			// Legacy goals, read until every account has a goal version.
			ctx.db
				.query("nutritionGoals")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.first(),
			ctx.db
				.query("nutritionDiaryEntries")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.first(),
			ctx.db
				.query("workoutSessions")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.first(),
			ctx.db
				.query("activities")
				.withIndex("by_user_occurred_at", (q) => q.eq("userId", userId))
				.first(),
			ctx.db
				.query("wodResults")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.first(),
		]);
		return { empty: found.every((row) => row === null) };
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
		const identity = await getIdentity(ctx);
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
	handler: async (
		ctx,
		{ authorizationCode, bundleId = APPLE_CLIENT_IDS[0] },
	) => {
		if (!(await getIdentity(ctx))) throw new ConvexError("unauthenticated");
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
