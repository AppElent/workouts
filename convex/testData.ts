import { ConvexError, v } from "convex/values";
import { destinationFor } from "../env.manifest";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { deletePersonalData, personalDataBlocker } from "./lib/personalData";
import { loadTestDataBaseline } from "./lib/testDataBaseline";
import { assertDiaryDate } from "./nutritionDiary";

function enabled() {
	const production = destinationFor("convex-functions", "production");
	const cloudUrl = process.env.CONVEX_CLOUD_URL;
	const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;
	if (!cloudUrl || !issuer || production?.kind !== "convex") return false;
	try {
		return (
			new URL(cloudUrl).hostname.split(".")[0] !== production.deployment &&
			new URL(issuer).hostname.endsWith(".clerk.accounts.dev")
		);
	} catch {
		return false;
	}
}

export const availability = query({
	args: {},
	returns: v.object({
		available: v.boolean(),
		blocker: v.union(
			v.literal("activeActivity"),
			v.literal("hostedWorkout"),
			v.null(),
		),
	}),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		const available = !!identity && enabled();
		return {
			available,
			blocker:
				available && identity
					? await personalDataBlocker(ctx, identity.subject)
					: null,
		};
	},
});

export const reset = mutation({
	args: {
		mode: v.union(v.literal("load"), v.literal("clear")),
		expectedSubject: v.string(),
		today: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new ConvexError("unauthenticated");
		if (!enabled()) throw new ConvexError("unavailable");
		if (identity.subject !== args.expectedSubject)
			throw new ConvexError("accountChanged");
		const reason = await personalDataBlocker(ctx, identity.subject);
		if (reason) throw new ConvexError(reason);
		assertDiaryDate(args.today);
		await clearPersonalData(ctx, identity.subject);
		if (args.mode === "load")
			await loadTestDataBaseline(ctx, identity.subject, args.today);
		return null;
	},
});

// One transaction: a rejected or oversized reset never leaves half an account.
// Bound total reads/writes, including receipts; leave room for the baseline.
async function clearPersonalData(ctx: MutationCtx, userId: string) {
	if (
		!(await deletePersonalData(ctx, userId, {
			budget: 6000,
			keepPreferences: true,
		}))
	)
		throw new ConvexError("tooLarge");
}
