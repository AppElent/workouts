/// <reference types="vite/client" />

import type { FunctionReturnType } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { type ExportCursor, exportTables } from "./lib/personalData";
import { loadTestDataBaseline } from "./lib/testDataBaseline";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

type Tester = ReturnType<typeof convexTest>;

async function seeded() {
	const t = convexTest(schema, modules);
	await t.run(async (ctx) => {
		for (const userId of ["alice", "bob"])
			await loadTestDataBaseline(ctx, userId, "2026-10-10");
	});
	return t;
}

/** Drains `exportPage`, counting calls. */
async function drain(t: Tester, subject: string) {
	const user = t.withIdentity({ subject });
	const tables: Record<string, unknown[]> = {};
	let cursor: string | null = null;
	let pages = 0;
	do {
		const page: FunctionReturnType<typeof api.accountPortal.exportPage> =
			await user.query(api.accountPortal.exportPage, { cursor });
		expect(page).toMatchObject({ contract: 1, app: "foundry" });
		for (const [table, rows] of Object.entries(page.tables))
			tables[table] = [...(tables[table] ?? []), ...rows];
		cursor = page.next;
		pages++;
	} while (cursor);
	return { tables, pages };
}

/** The in-app export, for comparison; empty tables dropped. */
async function inAppExport(t: Tester, subject: string) {
	const user = t.withIdentity({ subject });
	const tables: Record<string, unknown[]> = {};
	let cursor: ExportCursor = null;
	do {
		const page: { table: string; rows: unknown[]; next: ExportCursor } =
			await user.query(api.exportData.personalPage, { cursor });
		if (page.rows.length > 0)
			tables[page.table] = [...(tables[page.table] ?? []), ...page.rows];
		cursor = page.next;
	} while (cursor);
	return tables;
}

async function allRows(t: Tester) {
	return t.run(async (ctx) => {
		const counts: Record<string, number> = {};
		for (const table of exportTables)
			counts[table] = (await ctx.db.query(table).collect()).length;
		return counts;
	});
}

describe("account portal", () => {
	it("answers a never-used caller with null, an empty export, and no writes", async () => {
		const t = convexTest(schema, modules);
		const before = await allRows(t);
		const carol = t.withIdentity({ subject: "carol" });
		expect(await carol.query(api.accountPortal.summary, {})).toBeNull();
		expect(await carol.query(api.accountPortal.deletionBlocker, {})).toBeNull();
		expect(
			await carol.query(api.accountPortal.exportPage, { cursor: null }),
		).toEqual({ contract: 1, app: "foundry", tables: {}, next: null });
		expect(await allRows(t)).toEqual(before);
	});

	it("answers a signed-out caller with null and refuses its export", async () => {
		const t = await seeded();
		expect(await t.query(api.accountPortal.summary, {})).toBeNull();
		expect(await t.query(api.accountPortal.deletionBlocker, {})).toBeNull();
		await expect(
			t.query(api.accountPortal.exportPage, { cursor: null }),
		).rejects.toThrow("unauthenticated");
	});

	it("counts a populated caller's data per exported table", async () => {
		const t = await seeded();
		const alice = t.withIdentity({ subject: "alice" });
		const exported = await inAppExport(t, "alice");
		const summary = await alice.query(api.accountPortal.summary, {});
		expect(summary).toMatchObject({ contract: 1, lastActiveAt: null });
		expect(summary?.counts.map(({ key }) => key)).toEqual(exportTables);
		for (const { key, count, more } of summary?.counts ?? []) {
			expect(count).toBe(exported[key]?.length ?? 0);
			expect(more).toBe(false);
		}
		expect(
			summary?.counts.find(({ key }) => key === "sets")?.count,
		).toBeGreaterThan(0);
	});

	it("caps a count at 1,000 with `more`", async () => {
		const t = convexTest(schema, modules);
		await t.run(async (ctx) => {
			for (let date = 0; date < 1001; date++)
				await ctx.db.insert("bodyMetrics", {
					userId: "alice",
					date,
					weight: 80,
					unit: "kg",
				});
		});
		const summary = await t
			.withIdentity({ subject: "alice" })
			.query(api.accountPortal.summary, {});
		expect(summary?.counts.find(({ key }) => key === "bodyMetrics")).toEqual({
			key: "bodyMetrics",
			count: 1000,
			more: true,
		});
	});

	it("drains the in-app export across pages to `next: null`", async () => {
		const t = await seeded();
		await t.run(async (ctx) => {
			// More than one page (200 rows) in one table.
			for (let date = 0; date < 450; date++)
				await ctx.db.insert("bodyMetrics", {
					userId: "alice",
					date,
					weight: 80,
					unit: "kg",
				});
		});
		const { tables, pages } = await drain(t, "alice");
		expect(tables).toEqual(await inAppExport(t, "alice"));
		expect(tables.bodyMetrics.length).toBeGreaterThanOrEqual(450);
		expect(pages).toBeGreaterThan(3);
		expect(tables).not.toHaveProperty("nutritionDiaryOperationReceipts");
	});

	it("keeps a second account's rows out of the first account's portal", async () => {
		const t = await seeded();
		const { tables } = await drain(t, "bob");
		expect(Object.keys(tables).length).toBeGreaterThan(0);
		for (const rows of Object.values(tables))
			for (const row of rows) expect(row).toMatchObject({ userId: "bob" });

		const dave = t.withIdentity({ subject: "dave" });
		expect(await dave.query(api.accountPortal.summary, {})).toBeNull();
		expect(await drain(t, "dave")).toEqual({ tables: {}, pages: 1 });

		// A mid-table cursor from Alice resumes Dave's own export, never Alice's.
		await t.run(async (ctx) => {
			for (let date = 0; date < 250; date++)
				await ctx.db.insert("bodyMetrics", {
					userId: "alice",
					date,
					weight: 80,
					unit: "kg",
				});
		});
		const alice = t.withIdentity({ subject: "alice" });
		let cursor: string | null = null;
		do {
			const page: FunctionReturnType<typeof api.accountPortal.exportPage> =
				await alice.query(api.accountPortal.exportPage, { cursor });
			cursor = page.next;
		} while (cursor && JSON.parse(cursor).cursor === null);
		expect(cursor).not.toBeNull();
		const resumed = await dave.query(api.accountPortal.exportPage, { cursor });
		expect(resumed.tables).toEqual({});
	});

	it("reports a running Activity as the deletion blocker", async () => {
		const t = await seeded();
		const alice = t.withIdentity({ subject: "alice" });
		expect(await alice.query(api.accountPortal.deletionBlocker, {})).toBeNull();
		await alice.mutation(api.workoutSessions.create, {});
		expect(await alice.query(api.accountPortal.deletionBlocker, {})).toEqual({
			code: "activeActivity",
			params: {},
		});
		expect(
			await t
				.withIdentity({ subject: "bob" })
				.query(api.accountPortal.deletionBlocker, {}),
		).toBeNull();
	});

	it("rejects a malformed cursor", async () => {
		const t = await seeded();
		const alice = t.withIdentity({ subject: "alice" });
		for (const cursor of [
			"not json",
			"null",
			'{"table":"hostedWorkouts","cursor":null}',
			'{"table":"sets"}',
			'{"table":"sets","cursor":5}',
		])
			await expect(
				alice.query(api.accountPortal.exportPage, { cursor }),
			).rejects.toThrow("invalid");
	});
});
