import { v } from "convex/values";
import type { NutritionOperationEnvelope } from "@workouts/core";
import { diaryPartSnapshotFields, diarySnapshotFields, mealSlot } from "./nutritionDiaryModel";

const operationTarget = v.union(
	v.object({ kind: v.literal("serverId"), id: v.id("nutritionDiaryEntries") }),
	v.object({ kind: v.literal("clientEntryId"), id: v.string() }),
);

const operationEntry = v.object({
	...diarySnapshotFields,
	clientEntryId: v.string(),
});

const operationPart = v.object({
	...diaryPartSnapshotFields,
	comboGroup: v.optional(v.object({
		id: v.string(),
		comboId: v.string(),
		name: v.string(),
	})),
	clientEntryId: v.string(),
});

export const operationArgs = {
	version: v.literal(1),
	operationId: v.string(),
	expectedSubject: v.string(),
	operation: v.union(
		v.object({ kind: v.literal("create"), entry: operationEntry }),
		v.object({
			kind: v.literal("createBatch"),
			date: v.string(),
			meal: mealSlot,
			entries: v.array(operationPart),
		}),
		v.object({
			kind: v.literal("update"),
			target: operationTarget,
			quantity: v.optional(v.number()),
			date: v.optional(v.string()),
			meal: v.optional(mealSlot),
		}),
		v.object({ kind: v.literal("remove"), target: operationTarget }),
	),
} satisfies Record<keyof NutritionOperationEnvelope, unknown>;

export const operationResult = v.object({
	entryIds: v.array(v.id("nutritionDiaryEntries")),
	clientEntryIds: v.array(v.string()),
	days: v.array(v.any()),
});
