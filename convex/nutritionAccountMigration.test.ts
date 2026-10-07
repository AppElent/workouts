/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
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
