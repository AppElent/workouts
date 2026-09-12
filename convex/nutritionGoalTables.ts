import { defineTable } from "convex/server";
import { v } from "convex/values";

const nutrient = v.union(
	v.literal("energy"),
	v.literal("protein"),
	v.literal("carbs"),
	v.literal("fat"),
	v.literal("saturatedFat"),
	v.literal("fibre"),
	v.literal("sugars"),
	v.literal("salt"),
);

const direction = v.union(v.literal("min"), v.literal("max"));
const sourcePreset = v.union(
	v.literal("reference"),
	v.literal("loseWeight"),
	v.literal("buildMuscle"),
);

/**
 * Schema additions for effective-dated Nutrition goals.
 *
 * The existing `nutritionGoals` table is the release-1 legacy source and is
 * deliberately not redefined here. A version is one document containing the
 * complete goal set, including an intentional empty set. That makes replacing
 * one effective date atomic and leaves every other date immutable.
 */
export const nutritionGoalTables = {
	nutritionGoalVersions: defineTable({
		userId: v.string(),
		effectiveFrom: v.string(),
		goals: v.array(
			v.object({
				nutrient,
				direction,
				target: v.number(),
				sourcePreset: v.optional(sourcePreset),
			}),
		),
		// Set only on the first version. It freezes the legacy current goals so
		// dates before the first explicit version never drift later.
		referenceGoals: v.optional(
			v.array(
				v.object({
					nutrient,
					direction,
					target: v.number(),
					sourcePreset: v.optional(sourcePreset),
				}),
			),
		),
	})
		.index("by_user_effectiveFrom", ["userId", "effectiveFrom"])
		.index("by_user", ["userId"]),
};
