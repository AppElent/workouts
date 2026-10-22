/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { deletePersonalData, exportTables } from "./lib/personalData";
import { loadTestDataBaseline } from "./lib/testDataBaseline";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function seeded() {
	const t = convexTest(schema, modules);
	await t.run(async (ctx) => {
		for (const userId of ["alice", "bob"]) {
			await loadTestDataBaseline(ctx, userId, "2026-10-10");
			await ctx.db.insert("nutritionGoalPreferences", {
				userId,
				displayOrder: [],
			});
		}
	});
	return t;
}

async function exportAll(t: ReturnType<typeof convexTest>, subject: string) {
	const user = t.withIdentity({ subject });
	const tables: Record<string, unknown[]> = {};
	let cursor: { table: string; cursor: string | null } | null = null;
	do {
		const page: {
			table: string;
			rows: unknown[];
			next: { table: string; cursor: string | null } | null;
		} = await user.query(api.exportData.personalPage, { cursor });
		tables[page.table] = [...(tables[page.table] ?? []), ...page.rows];
		cursor = page.next;
	} while (cursor);
	return tables;
}

describe("account data", () => {
	it("exports every personal table for the signed-in account only", async () => {
		const t = await seeded();
		const tables = await exportAll(t, "alice");
		expect(Object.keys(tables)).toEqual(exportTables);
		expect(tables.nutritionDiaryEntries.length).toBeGreaterThan(0);
		expect(tables.sets.length).toBeGreaterThan(0);
		expect(tables).not.toHaveProperty("nutritionDiaryOperationReceipts");
		for (const rows of Object.values(tables))
			for (const row of rows) expect(row).toMatchObject({ userId: "alice" });
	});

	it("deletes all personal data in resumable batches and leaves other accounts intact", async () => {
		const t = await seeded();
		const before = await exportAll(t, "bob");
		expect(
			await t.run((ctx) =>
				deletePersonalData(ctx, "alice", { budget: 5, keepPreferences: false }),
			),
		).toBe(false);
		const alice = t.withIdentity({ subject: "alice" });
		let done = false;
		while (!done)
			({ done } = await alice.mutation(api.account.deleteData, {
				expectedSubject: "alice",
			}));
		const after = await exportAll(t, "alice");
		for (const rows of Object.values(after)) expect(rows).toEqual([]);
		expect(await exportAll(t, "bob")).toEqual(before);
		expect(
			await t.run((ctx) => ctx.db.query("nutritionFoodPhotos").collect()),
		).toEqual(
			expect.not.arrayContaining([
				expect.objectContaining({ userId: "alice" }),
			]),
		);
	});

	it("rejects deletion for another subject, signed-out callers, and running Activities", async () => {
		const t = await seeded();
		const alice = t.withIdentity({ subject: "alice" });
		await expect(
			alice.mutation(api.account.deleteData, { expectedSubject: "bob" }),
		).rejects.toThrow("accountChanged");
		await expect(
			t.mutation(api.account.deleteData, { expectedSubject: "alice" }),
		).rejects.toThrow("unauthenticated");
		await alice.mutation(api.workoutSessions.create, {});
		expect(await alice.query(api.account.deletionBlocker, {})).toBe(
			"activeActivity",
		);
		await expect(
			alice.mutation(api.account.deleteData, { expectedSubject: "alice" }),
		).rejects.toThrow("activeActivity");
		expect((await exportAll(t, "alice")).sets.length).toBeGreaterThan(0);
	});
});
