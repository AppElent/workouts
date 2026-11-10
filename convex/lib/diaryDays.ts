import { type IsoDate, isRealIsoDate, totalNutrients } from "@foundry/core";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "./errors";

export function assertIsoDate(
	date: string,
	field = "date",
): asserts date is IsoDate {
	if (!isRealIsoDate(date)) throw appError("invalid", field);
}

function dayVersion(ctx: QueryCtx | MutationCtx, userId: string, date: string) {
	return ctx.db
		.query("nutritionDiaryDayVersions")
		.withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
		.first();
}

/** Marks a diary day changed so devices holding its snapshot refresh it. */
export async function bumpDayRevision(
	ctx: MutationCtx,
	userId: string,
	date: string,
) {
	const row = await dayVersion(ctx, userId, date);
	if (row) await ctx.db.patch(row._id, { revision: row.revision + 1 });
	else
		await ctx.db.insert("nutritionDiaryDayVersions", {
			userId,
			date,
			revision: 1,
		});
}

/** A diary day's entries with stored photos resolved, totals and revision. */
export async function daySnapshot(
	ctx: QueryCtx | MutationCtx,
	userId: string,
	date: string,
) {
	const entries = await ctx.db
		.query("nutritionDiaryEntries")
		.withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
		.collect();
	return {
		date,
		entries: await Promise.all(
			entries.map(async (entry) => {
				if (entry.visual?.kind !== "photo" || !entry.visual.storageId)
					return entry;
				const uri = await ctx.storage.getUrl(entry.visual.storageId);
				return { ...entry, visual: uri ? { ...entry.visual, uri } : undefined };
			}),
		),
		totals: totalNutrients(entries),
		revision: (await dayVersion(ctx, userId, date))?.revision ?? 0,
	};
}
