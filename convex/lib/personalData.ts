import type { GenericTableInfo, Query } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Db = QueryCtx["db"];

/**
 * Every account-owned table, read through its user index. `export: false`
 * marks bookkeeping (receipts, counters, versions) that carries no personal
 * content of its own; `preference` survives a test-data reset.
 */
const sources = {
	nutritionFoodPhotos: {
		export: false,
		read: (db: Db, u: string) =>
			db
				.query("nutritionFoodPhotos")
				.withIndex("by_user", (q) => q.eq("userId", u)),
	},
	workoutSessions: {
		read: (db: Db, u: string) =>
			db
				.query("workoutSessions")
				.withIndex("by_user", (q) => q.eq("userId", u)),
	},
	routines: {
		read: (db: Db, u: string) =>
			db.query("routines").withIndex("by_user", (q) => q.eq("userId", u)),
	},
	sets: {
		read: (db: Db, u: string) =>
			db.query("sets").withIndex("by_user", (q) => q.eq("userId", u)),
	},
	oneRepMaxes: {
		read: (db: Db, u: string) =>
			db.query("oneRepMaxes").withIndex("by_user", (q) => q.eq("userId", u)),
	},
	bodyMetrics: {
		read: (db: Db, u: string) =>
			db.query("bodyMetrics").withIndex("by_user", (q) => q.eq("userId", u)),
	},
	wodResults: {
		read: (db: Db, u: string) =>
			db.query("wodResults").withIndex("by_user", (q) => q.eq("userId", u)),
	},
	wods: {
		read: (db: Db, u: string) =>
			db.query("wods").withIndex("by_user", (q) => q.eq("userId", u)),
	},
	exercises: {
		read: (db: Db, u: string) =>
			db.query("exercises").withIndex("by_user", (q) => q.eq("userId", u)),
	},
	activities: {
		read: (db: Db, u: string) =>
			db
				.query("activities")
				.withIndex("by_user_occurred_at", (q) => q.eq("userId", u)),
	},
	enduranceActivityDetails: {
		read: (db: Db, u: string) =>
			db
				.query("enduranceActivityDetails")
				.withIndex("by_user", (q) => q.eq("userId", u)),
	},
	strengthLogReceipts: {
		export: false,
		read: (db: Db, u: string) =>
			db
				.query("strengthLogReceipts")
				.withIndex("by_user_operation", (q) => q.eq("userId", u)),
	},
	nutritionDiaryEntries: {
		read: (db: Db, u: string) =>
			db
				.query("nutritionDiaryEntries")
				.withIndex("by_user", (q) => q.eq("userId", u)),
	},
	nutritionDiaryOperationReceipts: {
		export: false,
		read: (db: Db, u: string) =>
			db
				.query("nutritionDiaryOperationReceipts")
				.withIndex("by_user_operation", (q) => q.eq("userId", u)),
	},
	nutritionDiaryDayVersions: {
		export: false,
		read: (db: Db, u: string) =>
			db
				.query("nutritionDiaryDayVersions")
				.withIndex("by_user_date", (q) => q.eq("userId", u)),
	},
	nutritionGoals: {
		read: (db: Db, u: string) =>
			db.query("nutritionGoals").withIndex("by_user", (q) => q.eq("userId", u)),
	},
	nutritionGoalVersions: {
		read: (db: Db, u: string) =>
			db
				.query("nutritionGoalVersions")
				.withIndex("by_user", (q) => q.eq("userId", u)),
	},
	nutritionGoalPreferences: {
		preference: true,
		read: (db: Db, u: string) =>
			db
				.query("nutritionGoalPreferences")
				.withIndex("by_user", (q) => q.eq("userId", u)),
	},
	nutritionLibraryRecords: {
		read: (db: Db, u: string) =>
			db
				.query("nutritionLibraryRecords")
				.withIndex("by_user_and_record", (q) => q.eq("userId", u)),
	},
	nutritionLibraryOperationReceipts: {
		export: false,
		read: (db: Db, u: string) =>
			db
				.query("nutritionLibraryOperationReceipts")
				.withIndex("by_user_and_operation", (q) => q.eq("userId", u)),
	},
	nutritionCaptureDrafts: {
		read: (db: Db, u: string) =>
			db
				.query("nutritionCaptureDrafts")
				.withIndex("by_user_and_record", (q) => q.eq("userId", u)),
	},
	nutritionCaptureDraftCounts: {
		export: false,
		read: (db: Db, u: string) =>
			db
				.query("nutritionCaptureDraftCounts")
				.withIndex("by_user_and_date", (q) => q.eq("userId", u)),
	},
	nutritionCaptureDraftReceipts: {
		export: false,
		read: (db: Db, u: string) =>
			db
				.query("nutritionCaptureDraftReceipts")
				.withIndex("by_user_and_operation", (q) => q.eq("userId", u)),
	},
	nutritionAiUsage: {
		export: false,
		read: (db: Db, u: string) =>
			db
				.query("nutritionAiUsage")
				.withIndex("by_user_and_day", (q) => q.eq("userId", u)),
	},
	personalMeasures: {
		read: (db: Db, u: string) =>
			db
				.query("personalMeasures")
				.withIndex("by_user_and_order", (q) => q.eq("userId", u)),
	},
	supplementaryServings: {
		read: (db: Db, u: string) =>
			db
				.query("supplementaryServings")
				.withIndex("by_userId_and_foodId", (q) => q.eq("userId", u)),
	},
} as const;

type Source = {
	export?: false;
	preference?: true;
	read: (db: Db, userId: string) => Query<GenericTableInfo>;
};
const all: Record<keyof typeof sources, Source> = sources;

export type ExportTable = {
	[K in keyof typeof sources]: (typeof sources)[K] extends { export: false }
		? never
		: K;
}[keyof typeof sources];
export const exportTables = (
	Object.keys(all) as (keyof typeof sources)[]
).filter((table): table is ExportTable => all[table].export !== false);

export function readPersonalTable(db: Db, table: ExportTable, userId: string) {
	return all[table].read(db, userId);
}

/** Running Activities and shared events make deleting personal records unsafe. */
export async function personalDataBlocker(
	ctx: QueryCtx | MutationCtx,
	userId: string,
) {
	const active = await ctx.db
		.query("workoutSessions")
		.withIndex("by_user_status", (q) =>
			q.eq("userId", userId).eq("status", "active"),
		)
		.first();
	if (active) return "activeActivity" as const;
	const host = await ctx.db
		.query("hostedWorkouts")
		.withIndex("by_host", (q) => q.eq("hostUserId", userId))
		.first();
	const participant = await ctx.db
		.query("hostedWorkoutParticipants")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.first();
	return host || participant ? ("hostedWorkout" as const) : null;
}

/**
 * Deletes at most `budget` personal rows (and their stored files). Returns
 * whether the account is now empty; callers repeat until it is, or throw to
 * roll back when the reset must be one transaction.
 */
export async function deletePersonalData(
	ctx: MutationCtx,
	userId: string,
	{ budget, keepPreferences }: { budget: number; keepPreferences: boolean },
) {
	let remaining = budget;
	for (const source of Object.values(all)) {
		if (keepPreferences && source.preference) continue;
		const rows = await source.read(ctx.db, userId).take(remaining + 1);
		const overflow = rows.length > remaining;
		for (const row of overflow ? rows.slice(0, remaining) : rows) {
			if ("isDefault" in row && row.isDefault) continue;
			if ("storageId" in row)
				await ctx.storage.delete(row.storageId as Id<"_storage">);
			await ctx.db.delete(row._id as Id<keyof typeof sources>);
		}
		if (overflow) return false;
		remaining -= rows.length;
	}
	return true;
}
