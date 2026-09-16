import { defineTable } from "convex/server";
import { v } from "convex/values";

export const personalMeasureTables = {
	personalMeasures: defineTable({
		userId: v.string(),
		name: v.string(),
		normalizedName: v.string(),
		amount: v.number(),
		unit: v.union(v.literal("g"), v.literal("ml")),
		order: v.number(),
	})
		.index("by_user_and_order", ["userId", "order"])
		.index("by_user_and_normalized_name", ["userId", "normalizedName"]),
};
