import { ConvexError, v } from "convex/values";
import { assertDiaryDate } from "./nutritionDiary";
import { destinationFor } from "../env.manifest";
import {
	mutation,
	query,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";
import { loadTestDataBaseline } from "./lib/testDataBaseline";

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

async function blocker(ctx: QueryCtx | MutationCtx, userId: string) {
	const active = await ctx.db
		.query("workoutSessions")
		.withIndex("by_user_status", (q) =>
			q.eq("userId", userId).eq("status", "active"),
		)
		.first();
	if (active) return "activeActivity" as const;
	const host = await ctx.db
		.query("hostedWorkouts")
		.withIndex("by_host", (q) => q.eq("hostUserId", userId))
		.first();
	const participant = await ctx.db
		.query("hostedWorkoutParticipants")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.first();
	return host || participant ? ("hostedWorkout" as const) : null;
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
				available && identity ? await blocker(ctx, identity.subject) : null,
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
		if (!enabled())
			throw new ConvexError("unavailable");
		if (identity.subject !== args.expectedSubject)
			throw new ConvexError("accountChanged");
		const reason = await blocker(ctx, identity.subject);
		if (reason) throw new ConvexError(reason);
		assertDiaryDate(args.today);
		await clearPersonalData(ctx, identity.subject);
		if (args.mode === "load") await loadTestDataBaseline(ctx, identity.subject, args.today);
		return null;
	},
});

// One transaction: a rejected or oversized reset never leaves half an account.
// Bound total reads/writes, including receipts; leave room for the baseline.
async function clearPersonalData(ctx: MutationCtx, userId: string) {
	const sources = [
		ctx.db.query("nutritionFoodPhotos").withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db
			.query("workoutSessions")
			.withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db
			.query("routines")
			.withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db.query("sets").withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db
			.query("oneRepMaxes")
			.withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db
			.query("bodyMetrics")
			.withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db
			.query("wodResults")
			.withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db.query("wods").withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db
			.query("exercises")
			.withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db
			.query("activities")
			.withIndex("by_user_occurred_at", (q) => q.eq("userId", userId)),
		ctx.db
			.query("enduranceActivityDetails")
			.withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db
			.query("strengthLogReceipts")
			.withIndex("by_user_operation", (q) => q.eq("userId", userId)),
		ctx.db
			.query("nutritionDiaryEntries")
			.withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db
			.query("nutritionDiaryOperationReceipts")
			.withIndex("by_user_operation", (q) => q.eq("userId", userId)),
		ctx.db
			.query("nutritionDiaryDayVersions")
			.withIndex("by_user_date", (q) => q.eq("userId", userId)),
		ctx.db
			.query("nutritionGoals")
			.withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db
			.query("nutritionGoalVersions")
			.withIndex("by_user", (q) => q.eq("userId", userId)),
		ctx.db
			.query("nutritionLibraryRecords")
			.withIndex("by_user_and_record", (q) => q.eq("userId", userId)),
		ctx.db
			.query("nutritionLibraryOperationReceipts")
			.withIndex("by_user_and_operation", (q) => q.eq("userId", userId)),
		ctx.db
			.query("nutritionCaptureDrafts")
			.withIndex("by_user_and_record", (q) => q.eq("userId", userId)),
		ctx.db
			.query("nutritionCaptureDraftCounts")
			.withIndex("by_user_and_date", (q) => q.eq("userId", userId)),
		ctx.db
			.query("nutritionCaptureDraftReceipts")
			.withIndex("by_user_and_operation", (q) => q.eq("userId", userId)),
		ctx.db
			.query("personalMeasures")
			.withIndex("by_user_and_order", (q) => q.eq("userId", userId)),
		ctx.db
			.query("supplementaryServings")
			.withIndex("by_userId_and_foodId", (q) => q.eq("userId", userId)),
	];
	let remaining = 6000;
	for (const source of sources) {
		const rows = await source.take(remaining + 1);
		if (rows.length > remaining)
			throw new ConvexError("tooLarge");
		remaining -= rows.length;
		for (const row of rows) {
			if ("isDefault" in row && row.isDefault) continue;
			if ("storageId" in row) await ctx.storage.delete(row.storageId);
			await ctx.db.delete(row._id);
		}
	}
}
