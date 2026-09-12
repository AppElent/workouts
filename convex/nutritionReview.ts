import {
	totalNutrients,
	type NutrientKey,
	type NutrientTotal,
} from "@workouts/core";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
	nutritionReviewToggleArgs,
	nutritionReviewToggleResult,
	nutritionReviewWeekArgs,
	nutritionReviewWeekResult,
} from "./nutritionReviewModel";

const MAX_ENTRIES_PER_DAY = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
async function requireUser(ctx: QueryCtx | MutationCtx) {
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

function addDays(date: string, days: number) {
	const [year, month, day] = date.split("-").map(Number);
	const result = new Date(Date.UTC(year, month - 1, day + days));
	return [
		result.getUTCFullYear(),
		String(result.getUTCMonth() + 1).padStart(2, "0"),
		String(result.getUTCDate()).padStart(2, "0"),
	].join("-");
}

function publicEntry(entry: Doc<"nutritionDiaryEntries">) {
	return {
		date: entry.date,
		meal: entry.meal,
		...(entry.comboGroup ? { comboGroup: entry.comboGroup } : {}),
		...(entry.clientEntryId ? { clientEntryId: entry.clientEntryId } : {}),
		name: entry.name,
		serving: entry.serving,
		quantity: entry.quantity,
		amount: entry.amount,
		baseUnit: entry.baseUnit,
		nutrients: entry.nutrients,
		provenance: entry.provenance,
		loggedAt: entry.loggedAt,
	};
}

async function markerFor(ctx: QueryCtx | MutationCtx, userId: string, date: string) {
	return ctx.db
		.query("nutritionReviewDayMarkers")
		.withIndex("by_user_date", (q) =>
			q.eq("userId", userId).eq("date", date),
		)
		.first();
}

function knownAverage(
	days: readonly { entries: readonly unknown[]; totals: Record<NutrientKey, NutrientTotal> }[],
	key: "energy" | "protein",
) {
	const known = days.filter(
		(day) =>
			day.entries.length > 0 &&
			!day.totals[key].incomplete &&
			!day.totals[key].qualified,
	);
	if (known.length === 0) return { days: 0 };
	return {
		value: known.reduce((sum, day) => sum + day.totals[key].amount, 0) / known.length,
		days: known.length,
	};
}

export const week = query({
	args: nutritionReviewWeekArgs,
	returns: nutritionReviewWeekResult,
	handler: async (ctx, { startDate }) => {
		const userId = await requireUser(ctx);
		assertRealDate(startDate);
		const dates = Array.from({ length: 7 }, (_, index) => addDays(startDate, index));
		const days = [];
		for (const date of dates) {
			const entries = await ctx.db
				.query("nutritionDiaryEntries")
				.withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
				.take(MAX_ENTRIES_PER_DAY + 1);
			if (entries.length > MAX_ENTRIES_PER_DAY) {
				throw new Error("This review day contains too many entries.");
			}
			const marker = await markerFor(ctx, userId, date);
			days.push({
				date,
				entries: entries.map(publicEntry),
				totals: totalNutrients(entries.map((entry) => entry.nutrients)),
				markedComplete: marker?.completed ?? false,
			});
		}
		const energy = knownAverage(days, "energy");
		const protein = knownAverage(days, "protein");
		return {
			startDate,
			endDate: dates[6] as string,
			days,
			coverage: {
				loggedDayCount: days.filter((day) => day.entries.length > 0).length,
				markedCompleteCount: days.filter((day) => day.markedComplete).length,
			},
			averages: {
				...(energy.value === undefined ? {} : { energy: energy.value }),
				...(protein.value === undefined ? {} : { protein: protein.value }),
				energyDays: energy.days,
				proteinDays: protein.days,
			},
		};
	},
});

export const toggleComplete = mutation({
	args: nutritionReviewToggleArgs,
	returns: nutritionReviewToggleResult,
	handler: async (ctx, { date, completed }) => {
		const userId = await requireUser(ctx);
		assertRealDate(date);
		const existing = await markerFor(ctx, userId, date);
		if (completed) {
			if (existing) {
				await ctx.db.patch(existing._id, { completed: true, updatedAt: Date.now() });
			} else {
				await ctx.db.insert("nutritionReviewDayMarkers", {
					userId,
					date,
					completed: true,
					updatedAt: Date.now(),
				});
			}
		} else if (existing) {
			await ctx.db.delete(existing._id);
		}
		return { date, completed };
	},
});
