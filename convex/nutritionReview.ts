import {
	type EffectiveGoalVersion,
	type NutritionGoal,
	resolveGoalHistory,
	totalNutrients,
	weekAverage,
} from "@foundry/core";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import {
	nutritionReviewWeekArgs,
	nutritionReviewWeekResult,
} from "./nutritionReviewModel";

const MAX_ENTRIES_PER_DAY = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
async function requireUser(ctx: QueryCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthenticated");
	return identity.subject;
}

function assertRealDate(date: string) {
	if (!DATE_PATTERN.test(date)) throw new Error("Invalid review date.");
	const [year, month, day] = date.split("-").map(Number);
	const candidate = new Date(Date.UTC(year, month - 1, day));
	if (
		candidate.getUTCFullYear() !== year ||
		candidate.getUTCMonth() !== month - 1 ||
		candidate.getUTCDate() !== day
	) {
		throw new Error("Invalid review date.");
	}
}

function assertMonday(date: string) {
	const [year, month, day] = date.split("-").map(Number);
	if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() !== 1) {
		throw new Error("A Week overview must start on Monday.");
	}
}

function addDays(date: string, days: number) {
	const [year, month, day] = date.split("-").map(Number);
	const result = new Date(Date.UTC(year, month - 1, day + days));
	return [
		result.getUTCFullYear(),
		String(result.getUTCMonth() + 1).padStart(2, "0"),
		String(result.getUTCDate()).padStart(2, "0"),
	].join("-");
}

async function goalsForWeek(
	ctx: QueryCtx,
	userId: string,
	startDate: string,
	endDate: string,
) {
	const versions = ctx.db.query("nutritionGoalVersions");
	const [beforeWeek, duringWeek, firstVersion, legacyRows] = await Promise.all([
		versions
			.withIndex("by_user_effectiveFrom", (q) =>
				q.eq("userId", userId).lt("effectiveFrom", startDate),
			)
			.order("desc")
			.first(),
		versions
			.withIndex("by_user_effectiveFrom", (q) =>
				q
					.eq("userId", userId)
					.gte("effectiveFrom", startDate)
					.lte("effectiveFrom", endDate),
			)
			.order("asc")
			.take(8),
		versions
			.withIndex("by_user_effectiveFrom", (q) => q.eq("userId", userId))
			.order("asc")
			.first(),
		ctx.db
			.query("nutritionGoals")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.take(16),
	]);
	const relevantVersions: EffectiveGoalVersion[] = [
		...(beforeWeek ? [beforeWeek] : []),
		...duringWeek,
	];
	const legacyGoals: NutritionGoal[] = legacyRows.map(
		({ nutrient, direction, target, sourcePreset }) => ({
			nutrient,
			direction,
			target,
			...(sourcePreset ? { sourcePreset } : {}),
		}),
	);
	return { relevantVersions, firstVersion, legacyGoals };
}

export const week = query({
	args: nutritionReviewWeekArgs,
	returns: nutritionReviewWeekResult,
	handler: async (ctx, { startDate, today }) => {
		const userId = await requireUser(ctx);
		assertRealDate(startDate);
		assertMonday(startDate);
		if (today !== undefined) assertRealDate(today);
		const dates = Array.from({ length: 7 }, (_, index) =>
			addDays(startDate, index),
		);
		const goalHistory = await goalsForWeek(
			ctx,
			userId,
			startDate,
			dates[6] as string,
		);
		const days = [];
		for (const date of dates) {
			const entries = await ctx.db
				.query("nutritionDiaryEntries")
				.withIndex("by_user_date", (q) =>
					q.eq("userId", userId).eq("date", date),
				)
				.take(MAX_ENTRIES_PER_DAY + 1);
			if (entries.length > MAX_ENTRIES_PER_DAY) {
				throw new Error("This review day contains too many entries.");
			}
			const resolvedGoals = resolveGoalHistory({
				date,
				legacyGoals: goalHistory.legacyGoals,
				versions: goalHistory.relevantVersions,
				referenceGoals: goalHistory.firstVersion?.referenceGoals,
			});
			days.push({
				date,
				entryCount: entries.length,
				totals: totalNutrients(entries),
				goals: resolvedGoals.basis === "effective" ? resolvedGoals.goals : [],
				goalBasis: resolvedGoals.basis,
				effectiveFrom: resolvedGoals.effectiveFrom,
			});
		}
		const throughDate = today ?? (dates[6] as string);
		const energy = weekAverage(days, "energy", throughDate);
		const protein = weekAverage(days, "protein", throughDate);
		return {
			startDate,
			endDate: dates[6] as string,
			days,
			averages: {
				...(energy ? { energy: energy.value } : {}),
				...(protein ? { protein: protein.value } : {}),
				energyDays: energy?.days ?? 0,
				proteinDays: protein?.days ?? 0,
				energyQualified: energy?.qualified ?? false,
				proteinQualified: protein?.qualified ?? false,
			},
		};
	},
});
