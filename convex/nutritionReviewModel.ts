import { v } from "convex/values";

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

const goal = v.object({
	nutrient: v.union(
		v.literal("energy"),
		v.literal("protein"),
		v.literal("carbs"),
		v.literal("fat"),
		v.literal("saturatedFat"),
		v.literal("fibre"),
		v.literal("sugars"),
		v.literal("salt"),
	),
	direction: v.union(v.literal("min"), v.literal("max")),
	target: v.number(),
	sourcePreset: v.optional(
		v.union(
			v.literal("reference"),
			v.literal("loseWeight"),
			v.literal("buildMuscle"),
		),
	),
});

export const nutritionReviewWeekArgs = {
	startDate: v.string(),
	today: v.optional(v.string()),
};

export const nutritionReviewWeekResult = v.object({
	startDate: v.string(),
	endDate: v.string(),
	days: v.array(
		v.object({
			date: v.string(),
			entryCount: v.number(),
			totals: nutritionReviewTotals,
			goals: v.array(goal),
			goalBasis: v.union(v.literal("effective"), v.literal("reference")),
			effectiveFrom: v.union(v.string(), v.null()),
		}),
	),
	averages: v.object({
		energy: v.optional(v.number()),
		protein: v.optional(v.number()),
		energyDays: v.number(),
		proteinDays: v.number(),
		energyQualified: v.boolean(),
		proteinQualified: v.boolean(),
	}),
});
