import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { resetTestData } from "./lib/testDataBaseline";
import { DEFAULT_WODS } from "./seedData/wods";

/**
 * Writes the benchmark WOD catalog. An existing catalog row with the same name
 * takes the shipped definition; personal WODs are never touched.
 */
export const seedWods = internalMutation({
	args: {},
	returns: v.object({ inserted: v.number(), updated: v.number() }),
	handler: async (ctx) => {
		let inserted = 0;
		let updated = 0;
		for (const wod of DEFAULT_WODS) {
			const existing = await ctx.db
				.query("wods")
				.withIndex("by_name", (q) => q.eq("name", wod.name))
				.filter((q) => q.eq(q.field("isDefault"), true))
				.first();
			if (existing) {
				await ctx.db.replace(existing._id, { ...wod, isDefault: true });
				updated++;
			} else {
				await ctx.db.insert("wods", { ...wod, isDefault: true });
				inserted++;
			}
		}
		return { inserted, updated };
	},
});

const testDataArgs = {
	userId: v.string(),
	/** The account's local calendar day; defaults to today in UTC. */
	today: v.optional(v.string()),
};

function utcToday() {
	return new Date().toISOString().slice(0, 10);
}

/** Replaces a development account's data with the test-data baseline. */
export const seedTestData = internalMutation({
	args: testDataArgs,
	returns: v.null(),
	handler: async (ctx, { userId, today = utcToday() }) => {
		await resetTestData(ctx, userId, "load", today);
		return null;
	},
});

/** Deletes a development account's personal data, keeping preferences. */
export const clearUserData = internalMutation({
	args: testDataArgs,
	returns: v.null(),
	handler: async (ctx, { userId, today = utcToday() }) => {
		await resetTestData(ctx, userId, "clear", today);
		return null;
	},
});
