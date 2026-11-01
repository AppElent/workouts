import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOWS = { day: 1, week: 7, month: 30 } as const;
type WindowName = keyof typeof WINDOWS;

/** Personal records whose creation marks a user as active. */
const TRACKED_TABLES = [
	"workoutSessions",
	"sets",
	"activities",
	"wodResults",
	"nutritionDiaryEntries",
	"bodyMetrics",
	"hostedWorkouts",
] as const;

/**
 * Aggregate usage for the operations dashboard: records created and distinct
 * active accounts per window. Internal only — run it with
 * `pnpm monitor:snapshot`. Reads only the last 30 days through the built-in
 * creation-time index, and returns counts, never record contents or user IDs.
 */
export const usageSnapshot = internalQuery({
	args: { now: v.optional(v.number()) },
	handler: async (ctx, { now = Date.now() }) => {
		const since = (window: WindowName) => now - WINDOWS[window] * DAY_MS;
		const records: Record<string, Record<WindowName, number>> = {};
		const activeUsers = Object.fromEntries(
			Object.keys(WINDOWS).map((window) => [window, new Set<string>()]),
		) as Record<WindowName, Set<string>>;

		for (const table of TRACKED_TABLES) {
			const counts = { day: 0, week: 0, month: 0 };
			const docs = await ctx.db
				.query(table)
				.withIndex("by_creation_time", (q) =>
					q.gte("_creationTime", since("month")),
				)
				.collect();
			for (const doc of docs) {
				const owner = "hostUserId" in doc ? doc.hostUserId : doc.userId;
				for (const window of Object.keys(WINDOWS) as WindowName[]) {
					if (doc._creationTime < since(window)) continue;
					counts[window]++;
					activeUsers[window].add(owner);
				}
			}
			records[table] = counts;
		}

		return {
			generatedAt: now,
			activeUsers: {
				day: activeUsers.day.size,
				week: activeUsers.week.size,
				month: activeUsers.month.size,
			},
			records,
		};
	},
});
