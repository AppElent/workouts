import {
	type IsoDate,
	type NutritionGoal,
	resolveGoalHistory,
} from "@foundry/core";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/** Goals saved before goal versions existed; they seed the reference goals. */
export async function readLegacyGoals(
	ctx: Ctx,
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

export function firstGoalVersion(ctx: Ctx, userId: string) {
	return ctx.db
		.query("nutritionGoalVersions")
		.withIndex("by_user_effectiveFrom", (q) => q.eq("userId", userId))
		.order("asc")
		.first();
}

/**
 * Reads the goal versions that apply anywhere from `from` through `to` and
 * returns the goals in force on a given day of that range.
 */
export async function readGoalHistory(
	ctx: Ctx,
	userId: string,
	from: IsoDate,
	to: IsoDate,
) {
	const versions = ctx.db.query("nutritionGoalVersions");
	const [inForce, changes, first, legacyGoals] = await Promise.all([
		versions
			.withIndex("by_user_effectiveFrom", (q) =>
				q.eq("userId", userId).lte("effectiveFrom", from),
			)
			.order("desc")
			.first(),
		versions
			.withIndex("by_user_effectiveFrom", (q) =>
				q
					.eq("userId", userId)
					.gt("effectiveFrom", from)
					.lte("effectiveFrom", to),
			)
			.order("asc")
			.take(8),
		firstGoalVersion(ctx, userId),
		readLegacyGoals(ctx, userId),
	]);
	const relevant = [...(inForce ? [inForce] : []), ...changes];
	return (date: IsoDate) =>
		resolveGoalHistory({
			date,
			legacyGoals,
			versions: relevant,
			referenceGoals: first?.referenceGoals,
		});
}
