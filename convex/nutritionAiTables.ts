import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Analyses per account per UTC day; bookkeeping only, no personal content. */
export const nutritionAiTables = {
	nutritionAiUsage: defineTable({
		userId: v.string(),
		day: v.string(),
		count: v.number(),
		/** Candidate selections still allowed: one per analysis. */
		choices: v.optional(v.number()),
	}).index("by_user_and_day", ["userId", "day"]),
};
