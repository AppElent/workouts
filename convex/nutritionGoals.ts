import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
	assertCalendarDate,
	resolveGoalHistory,
	utcTodayIsoDate,
	validateNutritionGoals,
	type EffectiveGoalVersion,
	type NutritionGoal,
} from "./nutritionGoalModel";
import {
	NUTRITION_NUTRIENTS,
	nutritionDisplayOrderValidator,
} from "./nutritionGoalTables";

type NutritionNutrient = (typeof NUTRITION_NUTRIENTS)[number];

async function requireUser(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthenticated");
	return identity.subject;
}

const goalValidator = v.object({
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

const goalsValidator = v.array(goalValidator);

async function readDisplayOrder(
	ctx: QueryCtx | MutationCtx,
	userId: string,
): Promise<NutritionNutrient[]> {
	const preference = await ctx.db
		.query("nutritionGoalPreferences")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.unique();
	return preference?.displayOrder ?? [...NUTRITION_NUTRIENTS];
}

function validateDisplayOrder(displayOrder: readonly NutritionNutrient[]): void {
	if (
		displayOrder.length !== NUTRITION_NUTRIENTS.length ||
		new Set(displayOrder).size !== NUTRITION_NUTRIENTS.length ||
		NUTRITION_NUTRIENTS.some((nutrient) => !displayOrder.includes(nutrient))
	)
		throw new Error(
			"Nutrition goal display order must contain every nutrient once.",
		);
}

async function readLegacyGoals(
	ctx: QueryCtx | MutationCtx,
	userId: string,
): Promise<NutritionGoal[]> {
	const rows = await ctx.db
		.query("nutritionGoals")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.take(16);
	return rows.map(({ nutrient, direction, target, sourcePreset }) => ({
		nutrient,
		direction,
		target,
		...(sourcePreset ? { sourcePreset } : {}),
	}));
}

async function readEffectiveVersion(
	ctx: QueryCtx | MutationCtx,
	userId: string,
	date: string,
): Promise<{
	version: EffectiveGoalVersion | null;
	firstVersion: EffectiveGoalVersion | null;
}> {
	const table = ctx.db.query("nutritionGoalVersions");
	const [version, firstVersion] = await Promise.all([
		table
			.withIndex("by_user_effectiveFrom", (q) =>
				q.eq("userId", userId).lte("effectiveFrom", date),
			)
			.order("desc")
			.first(),
		table
			.withIndex("by_user_effectiveFrom", (q) => q.eq("userId", userId))
			.order("asc")
			.first(),
	]);
	return { version, firstVersion };
}

async function readExactEffectiveVersion(
	ctx: MutationCtx,
	userId: string,
	date: string,
): Promise<Doc<"nutritionGoalVersions"> | null> {
	const version = await ctx.db
		.query("nutritionGoalVersions")
		.withIndex("by_user_effectiveFrom", (q) =>
			q.eq("userId", userId).eq("effectiveFrom", date),
		)
		.order("asc")
		.first();
	return version;
}

export const list = query({
	args: {},
	returns: goalsValidator,
	handler: async (ctx) => {
		const userId = await requireUser(ctx);
		const date = utcTodayIsoDate();
		const [{ version, firstVersion }, legacyGoals] = await Promise.all([
			readEffectiveVersion(ctx, userId, date),
			readLegacyGoals(ctx, userId),
		]);
		return resolveGoalHistory({
			date,
			legacyGoals,
			versions: version ? [version] : [],
			referenceGoals: firstVersion?.referenceGoals,
		}).goals;
	},
});

export const forDate = query({
	args: { date: v.string() },
	returns: v.object({
		goals: goalsValidator,
		basis: v.union(v.literal("effective"), v.literal("reference")),
		effectiveFrom: v.union(v.string(), v.null()),
		displayOrder: nutritionDisplayOrderValidator,
	}),
	handler: async (ctx, { date }) => {
		assertCalendarDate(date);
		const userId = await requireUser(ctx);
		const [{ version, firstVersion }, legacyGoals, displayOrder] = await Promise.all([
			readEffectiveVersion(ctx, userId, date),
			readLegacyGoals(ctx, userId),
			readDisplayOrder(ctx, userId),
		]);
		return {
			...resolveGoalHistory({
				date,
				legacyGoals,
				versions: version ? [version] : [],
				referenceGoals: firstVersion?.referenceGoals,
			}),
			displayOrder,
		};
	},
});

export const setDisplayOrder = mutation({
	args: { displayOrder: nutritionDisplayOrderValidator },
	returns: v.null(),
	handler: async (ctx, { displayOrder }) => {
		const userId = await requireUser(ctx);
		validateDisplayOrder(displayOrder);
		const existing = await ctx.db
			.query("nutritionGoalPreferences")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		if (existing) await ctx.db.patch(existing._id, { displayOrder });
		else
			await ctx.db.insert("nutritionGoalPreferences", {
				userId,
				displayOrder,
			});
		return null;
	},
});

export const replace = mutation({
	args: { goals: goalsValidator, effectiveFrom: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, { goals, effectiveFrom }) => {
		const userId = await requireUser(ctx);
		const date = effectiveFrom ?? utcTodayIsoDate();
		assertCalendarDate(date);
		validateNutritionGoals(goals);

		const existing = await readExactEffectiveVersion(ctx, userId, date);
		if (existing) {
			await ctx.db.patch(existing._id, { goals });
		} else {
			const first = await ctx.db
				.query("nutritionGoalVersions")
				.withIndex("by_user_effectiveFrom", (q) => q.eq("userId", userId))
				.order("asc")
				.first();
			const referenceGoals =
				first?.referenceGoals ?? (await readLegacyGoals(ctx, userId));
			await ctx.db.insert("nutritionGoalVersions", {
				userId,
				effectiveFrom: date,
				goals,
				...(first && first.effectiveFrom <= date ? {} : { referenceGoals }),
			});
		}
		return null;
	},
});
