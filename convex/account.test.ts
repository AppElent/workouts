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

describe("first run", () => {
	it("is offered only to an account without goals and without history", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		expect(await alice.query(api.account.firstRun, {})).toEqual({
			empty: true,
		});
		expect(await t.query(api.account.firstRun, {})).toEqual({ empty: false });

		await alice.mutation(api.nutritionGoals.replace, {
			goals: [{ nutrient: "energy", direction: "max", target: 2400 }],
		});
		expect(await alice.query(api.account.firstRun, {})).toEqual({
			empty: false,
		});
	});

	it("is not offered to an account with history but no goals", async () => {
		const t = convexTest(schema, modules);
		const bob = t.withIdentity({ subject: "bob" });
		await bob.mutation(api.workoutSessions.create, {});
		expect(await bob.query(api.account.firstRun, {})).toEqual({
			empty: false,
		});

		const carol = t.withIdentity({ subject: "carol" });
		await t.run(async (ctx) => {
			await ctx.db.insert("activities", {
				userId: "carol",
				clientEntryId: "run-1",
				sport: "running",
				occurredAt: 1,
				durationSeconds: 1800,
				createdAt: 1,
				updatedAt: 1,
			});
		});
		expect(await carol.query(api.account.firstRun, {})).toEqual({
			empty: false,
		});
	});

	it("is not offered after a Diary Entry or a WOD result", async () => {
		const t = convexTest(schema, modules);
		const dave = t.withIdentity({ subject: "dave" });
		await dave.mutation(api.nutritionDiary.log, {
			date: "2026-11-10",
			meal: "snacks",
			name: { en: "Apple", nl: "Appel" },
			serving: { en: "Serving", nl: "Portie" },
			quantity: 1,
			amount: 100,
			baseUnit: "g",
			nutrients: {
				energy: { kind: "value", amount: 52 },
				protein: { kind: "value", amount: 0.3 },
				carbs: { kind: "value", amount: 14 },
				fat: { kind: "value", amount: 0.2 },
				saturatedFat: { kind: "value", amount: 0 },
				fibre: { kind: "value", amount: 2.4 },
				sugars: { kind: "value", amount: 10 },
				salt: { kind: "value", amount: 0 },
			},
			provenance: { source: "oneOff" },
		});
		expect(await dave.query(api.account.firstRun, {})).toEqual({
			empty: false,
		});

		const erin = t.withIdentity({ subject: "erin" });
		const wodId = await t.run((ctx) =>
			ctx.db.insert("wods", {
				userId: "erin",
				name: "Fran",
				type: "forTime",
				movements: [],
				isDefault: false,
			}),
		);
		await erin.mutation(api.wodResults.log, {
			wodId,
			rxScaled: "rx",
			timeSeconds: 300,
			date: 1,
		});
		expect(await erin.query(api.account.firstRun, {})).toEqual({
			empty: false,
		});
	});

	it("ignores another account's goals and history", async () => {
		const t = convexTest(schema, modules);
		const bob = t.withIdentity({ subject: "bob" });
		await bob.mutation(api.nutritionGoals.replace, {
			goals: [{ nutrient: "energy", direction: "max", target: 2400 }],
		});
		await bob.mutation(api.workoutSessions.create, {});
		expect(
			await t
				.withIdentity({ subject: "alice" })
				.query(api.account.firstRun, {}),
		).toEqual({ empty: true });
	});

	it("answers a connected app only with a Foundry scope", async () => {
		const t = convexTest(schema, modules);
		const app = (scope: string) =>
			t.withIdentity({ subject: "alice", client_id: "mcp-client", scope });
		expect(
			await app("openid profile email").query(api.account.firstRun, {}),
		).toEqual({ empty: false });
		expect(
			await app("openid foundry:read").query(api.account.firstRun, {}),
		).toEqual({ empty: true });
	});

	it("is not offered after test data loads history", async () => {
		const t = await seeded();
		await t.run(async (ctx) => {
			for (const row of await ctx.db.query("nutritionGoalVersions").collect())
				await ctx.db.delete(row._id);
			for (const row of await ctx.db.query("workoutSessions").collect())
				await ctx.db.delete(row._id);
		});
		const alice = t.withIdentity({ subject: "alice" });
		expect(await alice.query(api.account.firstRun, {})).toEqual({
			empty: false,
		});
	});
});
