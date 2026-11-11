import {
	isoWeekday,
	shiftIsoDate,
	totalNutrients,
	weekAverage,
} from "@foundry/core";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { assertIsoDate } from "./lib/diaryDays";
import { appError } from "./lib/errors";
import { readGoalHistory } from "./lib/goalHistory";
import { nutrientTotal, nutritionGoal, perNutrient } from "./lib/validators";

const MAX_ENTRIES_PER_DAY = 500;

export const week = query({
	args: { startDate: v.string(), today: v.optional(v.string()) },
	returns: v.object({
		startDate: v.string(),
		endDate: v.string(),
		days: v.array(
			v.object({
				date: v.string(),
				entryCount: v.number(),
				totals: perNutrient(nutrientTotal),
				goals: v.array(nutritionGoal),
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
	}),
	handler: async (ctx, { startDate, today }) => {
		const userId = await requireUserId(ctx);
		assertIsoDate(startDate, "startDate");
		if (isoWeekday(startDate) !== 0) throw appError("invalid", "startDate");
		if (today !== undefined) assertIsoDate(today, "today");
		const dates = Array.from({ length: 7 }, (_, index) =>
			shiftIsoDate(startDate, index),
		);
		const endDate = dates[6];
		const goalsOn = await readGoalHistory(ctx, userId, startDate, endDate);
		const days = [];
		for (const date of dates) {
			const entries = await ctx.db
				.query("nutritionDiaryEntries")
				.withIndex("by_user_date", (q) =>
					q.eq("userId", userId).eq("date", date),
				)
				.take(MAX_ENTRIES_PER_DAY + 1);
			if (entries.length > MAX_ENTRIES_PER_DAY)
				throw appError("tooLarge", "entries");
			const goals = goalsOn(date);
			days.push({
				date,
				entryCount: entries.length,
				totals: totalNutrients(entries),
				goals: goals.basis === "effective" ? goals.goals : [],
				goalBasis: goals.basis,
				effectiveFrom: goals.effectiveFrom,
			});
		}
		const throughDate = today ?? endDate;
		const energy = weekAverage(days, "energy", throughDate);
		const protein = weekAverage(days, "protein", throughDate);
		return {
			startDate,
			endDate,
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
