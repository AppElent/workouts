/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.*s");

it("previews and resumes bounded backfill pages without changing portable data", async () => {
	const t = convexTest(schema, modules);
	const payload = JSON.stringify({ name: { en: "Oats", nl: "Haver" }, provenance: { barcode: "1234" } });
	const id = await t.run(ctx => ctx.db.insert("nutritionLibraryRecords", { userId: "alice", recordId: "old", recordKind: "food", payload, revision: 2, deleted: false, updatedAt: 10 }));
	const args = { table: "library" as const, cursor: null, dryRun: true };
	expect(await t.mutation(internal.nutritionAccountMigration.backfill, args)).toMatchObject({ scanned: 1, changed: 1, isDone: true });
	expect(await t.run(ctx => ctx.db.get(id))).not.toHaveProperty("searchText");
	expect(await t.mutation(internal.nutritionAccountMigration.backfill, { ...args, dryRun: false })).toMatchObject({ changed: 1 });
	expect(await t.mutation(internal.nutritionAccountMigration.backfill, { ...args, dryRun: false })).toMatchObject({ changed: 0 });
	expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ payload, revision: 2, updatedAt: 10, barcode: "1234", name: "oats haver" });
});

it("repairs verified strength references without promoting unverified legacy history", async () => {
 const t = convexTest(schema, modules);
 const exerciseId = "shipped:exercise:barbell-bench-press";
 const { legacy, verified } = await t.run(async ctx => {
  const sessionId = await ctx.db.insert("workoutSessions", { userId: "alice", date: 1, startTime: 1, status: "completed" });
  const values = { userId: "alice", sessionId, exerciseId, setNumber: 1, reps: 1, weight: 300, unit: "kg" as const, setType: "working" as const, loggedAt: 1 };
  return {
   legacy: await ctx.db.insert("sets", values),
   verified: await ctx.db.insert("sets", { ...values, weight: 100, performanceVerified: true }),
  };
 });
 const original = await t.run(ctx => ctx.db.get(legacy));
 const args = { table: "sets" as const, cursor: null, dryRun: true };
 expect(await t.mutation(internal.nutritionAccountMigration.backfill, args)).toMatchObject({ scanned: 2, changed: 1, isDone: true });
 expect(await t.run(ctx => ctx.db.get(verified))).not.toHaveProperty("referenceKind");
 expect(await t.mutation(internal.nutritionAccountMigration.backfill, { ...args, dryRun: false })).toMatchObject({ changed: 1 });
 expect(await t.mutation(internal.nutritionAccountMigration.backfill, args)).toMatchObject({ changed: 0 });
 expect(await t.run(ctx => ctx.db.get(legacy))).toEqual(original);
 expect((await t.withIdentity({ subject: "alice" }).query(api.oneRepMaxes.getReferences, { exerciseId })).measured).toMatchObject({ value: 100, sourceSetId: verified });
});
