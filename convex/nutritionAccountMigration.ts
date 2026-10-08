import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { libraryIndexFields } from "./lib/nutritionLibraryIndex";
import { performanceReference, recalcStrengthReferences } from "./lib/strengthReferences";

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
  for (const row of page.page) {
   // Preserve unverified historical performances. Only repair references whose
   // performance was explicitly logged under the planned/performed boundary.
   const fields = await performanceReference(ctx, row.userId, row);
   if (row.referenceKind === fields.referenceKind && row.referenceValueKg === fields.referenceValueKg) continue;
   if (!dryRun) {
    await ctx.db.patch(row._id, fields);
    await recalcStrengthReferences(ctx, row.userId, row.exerciseId);
   }
   changed++;
  }
  return { isDone: page.isDone, continueCursor: page.continueCursor, scanned: page.page.length, changed };
 },
});
