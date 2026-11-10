import { NUTRIENT_KEYS, validateNutritionGoals } from "@foundry/core";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { assertIsoDate } from "./lib/diaryDays";
import { appError, checked } from "./lib/errors";
import {
	firstGoalVersion,
	readGoalHistory,
	readLegacyGoals,
} from "./lib/goalHistory";
import { nutrientKey, nutritionGoal } from "./lib/validators";

const goals = v.array(nutritionGoal);
const displayOrder = v.array(nutrientKey);

export const forDate = query({
	args: { date: v.string() },
	returns: v.object({
		goals,
		basis: v.union(v.literal("effective"), v.literal("reference")),
		effectiveFrom: v.union(v.string(), v.null()),
		/** Where the version in force on `date` stops applying, if anywhere. */
		nextEffectiveFrom: v.union(v.string(), v.null()),
		displayOrder,
	}),
	handler: async (ctx, { date }) => {
		assertIsoDate(date);
		const userId = await requireUserId(ctx);
		const [goalsOn, preference, next] = await Promise.all([
			readGoalHistory(ctx, userId, date, date),
			ctx.db
				.query("nutritionGoalPreferences")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.unique(),
			ctx.db
				.query("nutritionGoalVersions")
				.withIndex("by_user_effectiveFrom", (q) =>
					q.eq("userId", userId).gt("effectiveFrom", date),
				)
				.order("asc")
				.first(),
		]);
		return {
			nextEffectiveFrom: next?.effectiveFrom ?? null,
			...goalsOn(date),
			displayOrder: preference?.displayOrder ?? [...NUTRIENT_KEYS],
		};
	},
});

export const setDisplayOrder = mutation({
	args: { displayOrder },
	returns: v.null(),
	handler: async (ctx, { displayOrder }) => {
		const userId = await requireUserId(ctx);
		if (
			displayOrder.length !== NUTRIENT_KEYS.length ||
			new Set(displayOrder).size !== NUTRIENT_KEYS.length
		)
			throw appError("invalid", "displayOrder");
		const existing = await ctx.db
			.query("nutritionGoalPreferences")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		if (existing) await ctx.db.patch(existing._id, { displayOrder });
		else
			await ctx.db.insert("nutritionGoalPreferences", { userId, displayOrder });
		return null;
	},
});

/** Sets the goals in force from `effectiveFrom` until the next saved change. */
export const replace = mutation({
	args: { goals, effectiveFrom: v.string() },
	returns: v.null(),
	handler: async (ctx, { goals, effectiveFrom }) => {
		const userId = await requireUserId(ctx);
		assertIsoDate(effectiveFrom, "effectiveFrom");
		checked(validateNutritionGoals(goals));
		const existing = await ctx.db
			.query("nutritionGoalVersions")
			.withIndex("by_user_effectiveFrom", (q) =>
				q.eq("userId", userId).eq("effectiveFrom", effectiveFrom),
			)
			.first();
		if (existing) {
			await ctx.db.patch(existing._id, { goals });
			return null;
		}
		const first = await firstGoalVersion(ctx, userId);
		// The earliest version carries the goals that applied before any version.
		const referenceGoals =
			first?.referenceGoals ?? (await readLegacyGoals(ctx, userId));
		await ctx.db.insert("nutritionGoalVersions", {
			userId,
			effectiveFrom,
			goals,
			...(first && first.effectiveFrom <= effectiveFrom
				? {}
				: { referenceGoals }),
		});
		return null;
	},
});
