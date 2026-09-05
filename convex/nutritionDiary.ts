import { totalNutrients } from "@workouts/core";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { diarySnapshotFields } from "./nutritionDiaryModel";

async function requireUser(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthenticated");
	return identity.subject;
}

export const log = mutation({
	args: diarySnapshotFields,
	handler: async (ctx, snapshot) => {
		const userId = await requireUser(ctx);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)) throw new Error("Invalid diary date.");
		if (!(snapshot.quantity > 0) || !(snapshot.amount > 0)) throw new Error("Quantity must be greater than zero.");
		return ctx.db.insert("nutritionDiaryEntries", {
			userId,
			...snapshot,
			loggedAt: Date.now(),
		});
	},
});

export const day = query({
	args: { date: v.string() },
	handler: async (ctx, { date }) => {
		const userId = await requireUser(ctx);
		const entries = await ctx.db
			.query("nutritionDiaryEntries")
			.withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
			.collect();
		const totals = totalNutrients(entries.map((entry) => entry.nutrients));
		return { entries, totals };
	},
});
