import { canonicalJson } from "@workouts/core";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { captureDraft, draftInput } from "./nutritionDraftTables";
import { assertDiaryDate } from "./nutritionDiary";

async function requireUser(ctx: QueryCtx | MutationCtx) {
 const identity = await ctx.auth.getUserIdentity();
 if (!identity) throw new Error("Unauthenticated");
 return identity.subject;
}
function asDraft(row: Doc<"nutritionCaptureDrafts">) {
 return { id: row.recordId, subject: row.userId, date: row.date, meal: row.meal, note: row.note, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
async function changeCount(ctx: MutationCtx, userId: string, date: string, delta: number) {
 const current = await ctx.db.query("nutritionCaptureDraftCounts").withIndex("by_user_and_date", q => q.eq("userId", userId).eq("date", date)).unique();
 const count = (current?.count ?? 0) + delta;
 if (current) {
  if (count === 0) await ctx.db.delete(current._id);
  else await ctx.db.patch(current._id, { count });
 } else if (count > 0) await ctx.db.insert("nutritionCaptureDraftCounts", { userId, date, count });
}

export const list = query({
 args: { startDate: v.string(), endDate: v.string(), paginationOpts: paginationOptsValidator },
 returns: v.object({ page: v.array(captureDraft), isDone: v.boolean(), continueCursor: v.string() }),
 handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  assertDiaryDate(args.startDate); assertDiaryDate(args.endDate);
  const days = (Date.parse(args.endDate) - Date.parse(args.startDate)) / 86400000;
  if (days < 0 || days > 61) throw new Error("Draft range must contain 1–62 days.");
  const result = await ctx.db.query("nutritionCaptureDrafts")
   .withIndex("by_user_and_deleted_and_date", q => q.eq("userId", userId).eq("deleted", false).gte("date", args.startDate).lte("date", args.endDate))
   .paginate({ ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, 100) });
  return { isDone: result.isDone, continueCursor: result.continueCursor, page: result.page.map(asDraft) };
 },
});

export const get = query({
 args: { id: v.string() },
 returns: v.union(captureDraft, v.null()),
 handler: async (ctx, { id }) => {
  const userId = await requireUser(ctx);
  const row = await ctx.db.query("nutritionCaptureDrafts").withIndex("by_user_and_record", q => q.eq("userId", userId).eq("recordId", id)).unique();
  return row && !row.deleted ? asDraft(row) : null;
 },
});

export const summary = query({
 args: { date: v.string() },
 returns: v.object({ count: v.number(), oldestDate: v.union(v.string(), v.null()) }),
 handler: async (ctx, { date }) => {
  const userId = await requireUser(ctx); assertDiaryDate(date);
  const [total, today, before, after] = await Promise.all([
   ctx.db.query("nutritionCaptureDraftCounts").withIndex("by_user_and_date", q => q.eq("userId", userId).eq("date", "")).unique(),
   ctx.db.query("nutritionCaptureDraftCounts").withIndex("by_user_and_date", q => q.eq("userId", userId).eq("date", date)).unique(),
   ctx.db.query("nutritionCaptureDrafts").withIndex("by_user_and_deleted_and_date", q => q.eq("userId", userId).eq("deleted", false).lt("date", date)).first(),
   ctx.db.query("nutritionCaptureDrafts").withIndex("by_user_and_deleted_and_date", q => q.eq("userId", userId).eq("deleted", false).gt("date", date)).first(),
  ]);
  return { count: (total?.count ?? 0) - (today?.count ?? 0), oldestDate: before?.date ?? after?.date ?? null };
 },
});

export const save = mutation({
 args: { expectedSubject: v.string(), operationId: v.string(), id: v.string(), action: v.union(v.literal("create"), v.literal("update"), v.literal("remove"), v.literal("migrate")), input: v.optional(draftInput), createdAt: v.optional(v.number()) },
 returns: v.union(captureDraft, v.null()),
 handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  if (userId !== args.expectedSubject) throw new Error("Subject mismatch.");
  if (!args.id.trim() || args.id.length > 2048 || !args.operationId.trim() || args.operationId.length > 1024) throw new Error("Draft identity is invalid.");
  if (args.createdAt !== undefined && (!Number.isFinite(args.createdAt) || args.createdAt < 0)) throw new Error("Draft timestamp is invalid.");
  const payload = canonicalJson(args);
  const receipt = await ctx.db.query("nutritionCaptureDraftReceipts").withIndex("by_user_and_operation", q => q.eq("userId", userId).eq("operationId", args.operationId)).unique();
  if (receipt) {
   if (receipt.payload !== payload) throw new Error("Operation ID was already used with a different payload.");
   return receipt.result;
  }
  const input = args.input;
  if (args.action !== "remove") {
   if (!input || !input.note.trim() || input.note.length > 10000) throw new Error("Draft note is invalid.");
   assertDiaryDate(input.date);
  }
  let recordId = args.id;
  let current = await ctx.db.query("nutritionCaptureDrafts").withIndex("by_user_and_record", q => q.eq("userId", userId).eq("recordId", recordId)).unique();
  if (args.action === "migrate" && current && (current.deleted || current.date !== input?.date || current.meal !== input?.meal || current.note !== input?.note)) {
   // Preserve the account version and the legacy note, with a stable retry identity.
   recordId = `legacy:${args.operationId}`;
   current = await ctx.db.query("nutritionCaptureDrafts").withIndex("by_user_and_record", q => q.eq("userId", userId).eq("recordId", recordId)).unique();
  }
  if (args.action === "update" && (!current || current.deleted)) throw new Error("This Capture Draft was deleted.");
  if (args.action === "create" && current) throw new Error("This Capture Draft already exists or was deleted.");
  let result: ReturnType<typeof asDraft> | null = null;
  if (args.action === "remove") {
   if (current && !current.deleted) {
    await ctx.db.patch(current._id, { deleted: true, note: "", updatedAt: Date.now() });
    await changeCount(ctx, userId, current.date, -1); await changeCount(ctx, userId, "", -1);
   }
  } else if (input) {
   const next = { userId, recordId, ...input, deleted: false, createdAt: current?.createdAt ?? args.createdAt ?? Date.now(), updatedAt: Date.now() };
   if (current) {
    if (args.action === "migrate") {
     if (current.deleted) throw new Error("This recovered Capture Draft was deleted.");
     result = asDraft(current);
    }
    else {
     await ctx.db.patch(current._id, next);
     result = { id: recordId, subject: userId, ...input, createdAt: next.createdAt, updatedAt: next.updatedAt };
     if (current.date !== input.date) { await changeCount(ctx, userId, current.date, -1); await changeCount(ctx, userId, input.date, 1); }
    }
   } else {
    await ctx.db.insert("nutritionCaptureDrafts", next);
    await changeCount(ctx, userId, input.date, 1); await changeCount(ctx, userId, "", 1);
    result = { id: recordId, subject: userId, ...input, createdAt: next.createdAt, updatedAt: next.updatedAt };
   }
  }
  await ctx.db.insert("nutritionCaptureDraftReceipts", { userId, operationId: args.operationId, payload, result });
  return result;
 },
});
