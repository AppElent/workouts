/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.*s");

describe("account-owned Capture Drafts", () => {
 it("preserves both legacy conflict versions and updates other-day counts on edits and deletion", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice" });
  const request = { expectedSubject: "alice", operationId: "original", id: "note", action: "create" as const, input: { date: "2026-10-07", meal: "lunch" as const, note: "Account note" } };
  await alice.mutation(api.nutritionDrafts.save, request);
  const legacy = { ...request, action: "migrate" as const, operationId: "migration", input: { ...request.input, date: "2026-10-06", note: "Legacy note" }, createdAt: 1 };
  const migrated = await alice.mutation(api.nutritionDrafts.save, legacy);
  expect(migrated).toMatchObject({ id: "legacy:migration", note: "Legacy note", createdAt: 1 });
  expect(await alice.mutation(api.nutritionDrafts.save, legacy)).toEqual(migrated);
  expect(await alice.query(api.nutritionDrafts.summary, { date: "2026-10-07" })).toEqual({ count: 1, oldestDate: "2026-10-06" });
  await alice.mutation(api.nutritionDrafts.save, { ...request, action: "update", operationId: "move", input: { ...request.input, date: "2026-10-06", note: "Last accepted" } });
  expect(await alice.query(api.nutritionDrafts.summary, { date: "2026-10-07" })).toEqual({ count: 2, oldestDate: "2026-10-06" });
  await alice.mutation(api.nutritionDrafts.save, { expectedSubject: "alice", operationId: "delete-copy", id: migrated!.id, action: "remove" });
  expect(await alice.query(api.nutritionDrafts.summary, { date: "2026-10-06" })).toEqual({ count: 0, oldestDate: null });
 });
 it("reloads saved notes in the owning account, deduplicates retries, and rejects updates after deletion", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice" });
  const bob = t.withIdentity({ subject: "bob" });
  const request = { expectedSubject: "alice", operationId: "create-note", id: "note-1", action: "create" as const, input: { date: "2026-10-07", meal: "lunch" as const, note: "Soup, remember to log" } };
  const saved = await alice.mutation(api.nutritionDrafts.save, request);
  expect(await alice.mutation(api.nutritionDrafts.save, request)).toEqual(saved);
  const args = { startDate: "2026-10-07", endDate: "2026-10-07", paginationOpts: { cursor: null, numItems: 50 } };
  expect((await alice.query(api.nutritionDrafts.list, args)).page).toEqual([saved]);
  expect((await bob.query(api.nutritionDrafts.list, args)).page).toEqual([]);
  await expect(bob.mutation(api.nutritionDrafts.save, request)).rejects.toThrow("Subject mismatch");
  await alice.mutation(api.nutritionDrafts.save, { expectedSubject: "alice", operationId: "remove-note", id: "note-1", action: "remove" });
  await expect(alice.mutation(api.nutritionDrafts.save, { ...request, operationId: "update-note", action: "update" })).rejects.toThrow("deleted");
  expect((await alice.query(api.nutritionDrafts.list, args)).page).toEqual([]);
 });
});
