import { formatQuantity, rescaleNutrients, totalNutrients } from "@workouts/core";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { diarySnapshotFields } from "./nutritionDiaryModel";

async function requireUser(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthenticated");
	return identity.subject;
}

async function requireOwnedEntry(
	ctx: MutationCtx,
	userId: string,
	id: Id<"nutritionDiaryEntries">,
) {
	const entry = await ctx.db.get(id);
	if (!entry || entry.userId !== userId) throw new Error("Unauthorized");
	return entry;
}

const DIARY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertDiaryDate(date: string) {
	if (!DIARY_DATE_PATTERN.test(date)) throw new Error("Invalid diary date.");
}

/**
 * `serving` is a snapshot string — "Glass (200 ml) × 1" — not a reference back
 * to the food, so a quantity edit updates only the multiplier at the end of
 * it. This is string surgery on the snapshot, never a re-read of the source.
 */
function rescaleServingLabel(label: string, quantity: number, locale: "en" | "nl") {
	const separator = label.lastIndexOf(" × ");
	const name = separator === -1 ? label : label.slice(0, separator);
	return `${name} × ${formatQuantity(quantity, locale)}`;
}

export const log = mutation({
	args: diarySnapshotFields,
	handler: async (ctx, snapshot) => {
		const userId = await requireUser(ctx);
		assertDiaryDate(snapshot.date);
		if (!(snapshot.quantity > 0) || !(snapshot.amount > 0)) throw new Error("Quantity must be greater than zero.");
		return ctx.db.insert("nutritionDiaryEntries", {
			userId,
			...snapshot,
			loggedAt: Date.now(),
		});
	},
});

export const day = query({
	args: { date: v.string() },
	handler: async (ctx, { date }) => {
		const userId = await requireUser(ctx);
		const entries = await ctx.db
			.query("nutritionDiaryEntries")
			.withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
			.collect();
		const totals = totalNutrients(entries.map((entry) => entry.nutrients));
		return { entries, totals };
	},
});

/**
 * Corrects an entry already logged: its meal, its calendar date, or its
 * quantity — any subset, in one save.
 *
 * A quantity change rescales the stored snapshot by the ratio of new to old
 * quantity. It never reads a shipped or Personal Food again — entries are
 * immutable snapshots (spec #68), so "editing" a quantity means transforming
 * the figures already on the entry, not re-deriving them from a source that
 * may since have changed, forked, or disappeared.
 */
export const update = mutation({
	args: {
		id: v.id("nutritionDiaryEntries"),
		quantity: v.optional(v.number()),
		meal: v.optional(
			v.union(
				v.literal("breakfast"),
				v.literal("lunch"),
				v.literal("dinner"),
				v.literal("snacks"),
			),
		),
		date: v.optional(v.string()),
	},
	handler: async (ctx, { id, quantity, meal, date }) => {
		const userId = await requireUser(ctx);
		const entry = await requireOwnedEntry(ctx, userId, id);

		if (date !== undefined) assertDiaryDate(date);

		const patch: Partial<typeof entry> = {};
		if (meal !== undefined) patch.meal = meal;
		if (date !== undefined) patch.date = date;
		if (quantity !== undefined) {
			if (!(quantity > 0)) throw new Error("Quantity must be greater than zero.");
			const factor = quantity / entry.quantity;
			patch.quantity = quantity;
			patch.amount = entry.amount * factor;
			patch.nutrients = rescaleNutrients(entry.nutrients, factor);
			patch.serving = {
				en: rescaleServingLabel(entry.serving.en, quantity, "en"),
				nl: rescaleServingLabel(entry.serving.nl, quantity, "nl"),
			};
		}

		if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
		return id;
	},
});

export const remove = mutation({
	args: { id: v.id("nutritionDiaryEntries") },
	handler: async (ctx, { id }) => {
		const userId = await requireUser(ctx);
		await requireOwnedEntry(ctx, userId, id);
		await ctx.db.delete(id);
	},
});
