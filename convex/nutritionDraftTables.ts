import { defineTable } from "convex/server";
import { v } from "convex/values";
import { mealSlot } from "./nutritionDiaryModel";

export const captureDraft = v.object({
	id: v.string(),
	subject: v.string(),
	date: v.string(),
	meal: mealSlot,
	note: v.string(),
	createdAt: v.number(),
	updatedAt: v.number(),
});
export const draftInput = v.object({
	date: v.string(),
	meal: mealSlot,
	note: v.string(),
});
export const nutritionDraftTables = {
	nutritionCaptureDrafts: defineTable({
		userId: v.string(),
		recordId: v.string(),
		date: v.string(),
		meal: mealSlot,
		note: v.string(),
		deleted: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_user_and_record", ["userId", "recordId"])
		.index("by_user_and_deleted_and_date", ["userId", "deleted", "date"]),
	nutritionCaptureDraftCounts: defineTable({
		userId: v.string(),
		date: v.string(),
		count: v.number(),
	}).index("by_user_and_date", ["userId", "date"]),
	nutritionCaptureDraftReceipts: defineTable({
		userId: v.string(),
		operationId: v.string(),
		payload: v.string(),
		result: v.union(captureDraft, v.null()),
	}).index("by_user_and_operation", ["userId", "operationId"]),
};
