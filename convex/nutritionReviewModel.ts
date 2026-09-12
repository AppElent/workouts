import { defineTable } from "convex/server";
import { v } from "convex/values";
import { diarySnapshotFields } from "./nutritionDiaryModel";

/** Tables owned by the weekly nutrition review slice. */
export const nutritionReviewTables = {
	nutritionReviewDayMarkers: defineTable({
		userId: v.string(),
		date: v.string(),
		completed: v.boolean(),
		updatedAt: v.number(),
	}).index("by_user_date", ["userId", "date"]),
};

const nutrientTotal = () =>
	v.object({
		amount: v.number(),
		entryCount: v.number(),
		valueCount: v.number(),
		traceCount: v.number(),
		absentCount: v.number(),
		incomplete: v.boolean(),
		qualified: v.boolean(),
	});

export const nutritionReviewTotals = v.object({
	energy: nutrientTotal(),
	protein: nutrientTotal(),
	carbs: nutrientTotal(),
	fat: nutrientTotal(),
	saturatedFat: nutrientTotal(),
	fibre: nutrientTotal(),
	sugars: nutrientTotal(),
	salt: nutrientTotal(),
});

export const nutritionReviewEntry = v.object({
	...diarySnapshotFields,
	loggedAt: v.number(),
});

export const nutritionReviewWeekArgs = {
	startDate: v.string(),
};

export const nutritionReviewWeekResult = v.object({
	startDate: v.string(),
	endDate: v.string(),
	days: v.array(
		v.object({
			date: v.string(),
			entries: v.array(nutritionReviewEntry),
			totals: nutritionReviewTotals,
			markedComplete: v.boolean(),
		}),
	),
	coverage: v.object({
		loggedDayCount: v.number(),
		markedCompleteCount: v.number(),
	}),
	averages: v.object({
		energy: v.optional(v.number()),
		protein: v.optional(v.number()),
		energyDays: v.number(),
		proteinDays: v.number(),
	}),
});

export const nutritionReviewToggleArgs = {
	date: v.string(),
	completed: v.boolean(),
};

export const nutritionReviewToggleResult = v.object({
	date: v.string(),
	completed: v.boolean(),
});
