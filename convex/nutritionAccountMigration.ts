import { calculateOneRepMax } from "@workouts/core";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { libraryIndexFields } from "./lib/nutritionLibraryIndex";

/** Operator-only, resumable pages. Repeat a cursor safely after an interrupted run. */
export const backfill = internalMutation({
 args: { table: v.union(v.literal("library"), v.literal("sets")), cursor: v.union(v.string(), v.null()), dryRun: v.boolean() },
 returns: v.object({ isDone: v.boolean(), continueCursor: v.string(), scanned: v.number(), changed: v.number() }),
 handler: async (ctx, { table, cursor, dryRun }) => {
  let changed = 0;
  if (table === "library") {
   const page = await ctx.db.query("nutritionLibraryRecords").paginate({ cursor, numItems: 100 });
   for (const row of page.page) if (row.searchText === undefined) {
    const fields = libraryIndexFields(row.recordKind, row.payload);
    if (!dryRun) await ctx.db.patch(row._id, fields);
    changed++;
   }
   return { isDone: page.isDone, continueCursor: page.continueCursor, scanned: page.page.length, changed };
  }
  const page = await ctx.db.query("sets").paginate({ cursor, numItems: 100 });
  for (const row of page.page) if (row.estimatedMax === undefined) {
   if (!dryRun) await ctx.db.patch(row._id, { estimatedMax: row.weight > 0 ? calculateOneRepMax(row.weight, row.reps).value : 0 });
   changed++;
  }
  return { isDone: page.isDone, continueCursor: page.continueCursor, scanned: page.page.length, changed };
 },
});
