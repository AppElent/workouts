import { defineTable } from "convex/server";
import { v } from "convex/values";

export const libraryRecordKind = v.union(v.literal("food"), v.literal("combo"));

/** Parent schema composes this object with the existing application tables. */
export const nutritionLibraryTables = {
	nutritionLibraryRecords: defineTable({
		userId: v.string(),
		recordId: v.string(),
		recordKind: libraryRecordKind,
		/** JSON is deliberately an opaque, validated snapshot to preserve mobile IDs. */
		payload: v.optional(v.string()),
		revision: v.number(),
		deleted: v.boolean(),
		updatedAt: v.number(),
	})
		.index("by_user_and_record", ["userId", "recordId"])
		.index("by_user_and_updated_at", ["userId", "updatedAt"]),

	nutritionLibraryOperationReceipts: defineTable({
		userId: v.string(),
		operationId: v.string(),
		payload: v.string(),
		result: v.string(),
		createdAt: v.number(),
	}).index("by_user_and_operation", ["userId", "operationId"]),
};
