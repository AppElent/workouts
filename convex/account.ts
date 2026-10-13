import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
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
