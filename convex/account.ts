import { APPLE_WEB_RETURN_URLS, APPLE_WEB_SERVICES_ID } from "@foundry/core";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
	action,
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	query,
} from "./_generated/server";
import {
	AppleAccountMismatch,
	appleCredentials,
	isAppleClientId,
	revokeAppleAuthorization,
} from "./lib/appleSignIn";
import { getOptionalUserId, requireSubject, requireUserId } from "./lib/auth";
import { rejectConnectedApps } from "./lib/connectedApps";
import { appError } from "./lib/errors";
import { deleteHostedWorkoutData } from "./lib/hosted";
import {
	accountDeletionBlocker,
	personalDataBlockerValidator as blocker,
	deletePersonalData,
} from "./lib/personalData";

/**
 * Why deleting this account's data is currently unsafe, if at all: only a
 * running Activity. `"hostedWorkout"` stays in the validator for installed
 * clients but is no longer returned.
 */
export const deletionBlocker = query({
	args: {},
	returns: blocker,
	handler: async (ctx) => {
		const userId = await getOptionalUserId(ctx);
		return userId ? await accountDeletionBlocker(ctx, userId) : null;
	},
});

/**
 * What web Apple revocation needs to know about an account, for the action,
 * which cannot read: its deletion blocker and its mirrored Apple users.
 */
export const appleRevocationCheck = internalQuery({
	args: { userId: v.string() },
	returns: v.object({ blocker, appleUserIds: v.array(v.string()) }),
	handler: async (ctx, { userId }) => {
		const link = await ctx.db
			.query("appleSignInLinks")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		return {
			blocker: await accountDeletionBlocker(ctx, userId),
			appleUserIds: link?.appleUserIds ?? [],
		};
	},
});

const appleLink = v.object({
	userId: v.string(),
	appleUserIds: v.array(v.string()),
	clerkUpdatedAt: v.number(),
});

/**
 * Mirrors one login's verified Apple users. A delivery older than the stored
 * one is ignored, so retries and out-of-order events are harmless; no Apple
 * user removes the row.
 */
async function storeAppleLink(
	ctx: MutationCtx,
	{
		userId,
		appleUserIds,
		clerkUpdatedAt,
	}: { userId: string; appleUserIds: string[]; clerkUpdatedAt: number },
) {
	const existing = await ctx.db
		.query("appleSignInLinks")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.unique();
	if (existing && existing.clerkUpdatedAt > clerkUpdatedAt) return;
	if (appleUserIds.length === 0) {
		if (existing) await ctx.db.delete(existing._id);
		return;
	}
	if (existing)
		await ctx.db.patch(existing._id, { appleUserIds, clerkUpdatedAt });
	else
		await ctx.db.insert("appleSignInLinks", {
			userId,
			appleUserIds,
			clerkUpdatedAt,
		});
}

/** Clerk `user.created` / `user.updated` (`POST /clerk/webhook`). */
export const syncAppleLink = internalMutation({
	args: appleLink.fields,
	returns: v.null(),
	handler: async (ctx, link) => {
		await storeAppleLink(ctx, link);
		return null;
	},
});

/**
 * One-off backfill for logins whose Apple link predates the webhook
 * subscription (`scripts/backfill-apple-links.mjs`, run locally). Same rules
 * as the webhook, so a newer delivery always wins.
 */
export const backfillAppleLinks = internalMutation({
	args: { links: v.array(appleLink) },
	returns: v.null(),
	handler: async (ctx, { links }) => {
		if (links.length > 100) throw appError("tooLarge", "links");
		for (const link of links) await storeAppleLink(ctx, link);
		return null;
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
		const userId = await getOptionalUserId(ctx).catch((error: unknown) => {
			if (error instanceof ConvexError) return null;
			throw error;
		});
		if (!userId) return { empty: false };
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

const PURGE_BUDGET = 2000;

/**
 * The one purge of an account's Foundry data, shared by in-app deletion and
 * the Clerk `user.deleted` webhook: one bounded batch, first the Hosted
 * Workouts it hosts (whole, guests included) and its participation and scores
 * in other events, then its personal training and nutrition data, Food photo
 * files included. Returns whether nothing is left. Shipped catalogs are
 * untouched, and Foundry keeps no profile row, so a later sign-in starts with
 * a fresh, empty account.
 */
async function purgeAccountBatch(ctx: MutationCtx, userId: string) {
	const budget = await deleteHostedWorkoutData(ctx, userId, PURGE_BUDGET);
	if (budget === null) return false;
	return deletePersonalData(ctx, userId, { budget, keepPreferences: false });
}

/**
 * Deletes one bounded batch of the signed-in account's personal data
 * (`purgeAccountBatch`). Callers repeat until `done`; an interrupted run
 * resumes where it stopped.
 */
export const deleteData = mutation({
	args: { expectedSubject: v.string() },
	returns: v.object({ done: v.boolean() }),
	handler: async (ctx, { expectedSubject }) => {
		await rejectConnectedApps(ctx);
		const userId = await requireSubject(ctx, expectedSubject);
		const reason = await accountDeletionBlocker(ctx, userId);
		if (reason) throw appError(reason);
		return { done: await purgeAccountBatch(ctx, userId) };
	},
});

/**
 * Purges a Clerk user's Foundry data after the AppElent login was deleted
 * (`POST /clerk/webhook`). Repeats itself batch by batch until nothing is
 * left; a repeated delivery, or a user without Foundry data, finds nothing
 * and stops. Nothing blocks it: a running Activity can no longer be finished
 * by anyone, and Hosted Workouts go as in in-app deletion.
 */
export const purgeDeletedUser = internalMutation({
	args: { userId: v.string() },
	returns: v.null(),
	handler: async (ctx, { userId }) => {
		// The login is gone, so its Apple link is too.
		const link = await ctx.db
			.query("appleSignInLinks")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		if (link) await ctx.db.delete(link._id);
		if (!(await purgeAccountBatch(ctx, userId)))
			await ctx.scheduler.runAfter(0, internal.account.purgeDeletedUser, {
				userId,
			});
		return null;
	},
});

/** Apple authorization codes are opaque strings of a few hundred characters. */
const MAX_AUTHORIZATION_CODE = 2000;

/**
 * Revokes the signed-in account's Sign in with Apple grant before the whole
 * AppElent account is deleted (never for Delete Foundry data). The code comes
 * from a fresh native Apple sheet on iOS, together with the bundle ID of the
 * build that showed it, or from an Apple JS popup on the web, with the web
 * Services ID as `bundleId` and the registered return URL it was requested
 * with. A grant can't be restored, so a web code is only exchanged once the
 * account may be deleted, and only revoked when its Apple user is one Clerk
 * links to this account, as mirrored by the Clerk webhook
 * (`appleAccountMismatch` otherwise, including when nothing is mirrored).
 * Other failures are one stable code; callers still delete the account.
 */
export const revokeAppleSignIn = action({
	args: {
		authorizationCode: v.string(),
		bundleId: v.string(),
		redirectUri: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, { authorizationCode, bundleId, redirectUri }) => {
		// Part of deleting the account, which stays in the Foundry app.
		await rejectConnectedApps(ctx);
		const userId = await requireUserId(ctx);
		if (!authorizationCode || authorizationCode.length > MAX_AUTHORIZATION_CODE)
			throw appError("invalid", "authorizationCode");
		if (!isAppleClientId(bundleId)) throw appError("invalid", "bundleId");
		const web = bundleId === APPLE_WEB_SERVICES_ID;
		// Web codes need their registered return URL; native codes have none.
		if (
			web
				? !redirectUri || !APPLE_WEB_RETURN_URLS.includes(redirectUri)
				: redirectUri !== undefined
		)
			throw appError("invalid", "redirectUri");
		const credentials = appleCredentials();
		if (!credentials) throw appError("unavailable");
		// Native revocation is not bound yet (APP-242 leftover): installed apps
		// would refuse every account whose Apple link is not mirrored yet.
		let appleUserIds: string[] | undefined;
		if (web) {
			const check = await ctx.runQuery(internal.account.appleRevocationCheck, {
				userId,
			});
			if (check.blocker) throw appError(check.blocker);
			appleUserIds = check.appleUserIds;
			if (appleUserIds.length === 0) throw appError("appleAccountMismatch");
		}
		try {
			await revokeAppleAuthorization(
				credentials,
				authorizationCode,
				bundleId,
				redirectUri,
				appleUserIds,
			);
		} catch (error) {
			if (error instanceof AppleAccountMismatch)
				throw appError("appleAccountMismatch");
			console.error("account.revokeAppleSignIn failed", error);
			throw appError("failed");
		}
		return null;
	},
});
