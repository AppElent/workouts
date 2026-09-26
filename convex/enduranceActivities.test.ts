/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const base = { clientEntryId: "client-1", sport: "running" as const, occurredAt: 1_780_000_000_000, durationSeconds: 1800, distanceMeters: 5000 };

describe("endurance activities", () => {
	it("requires auth and keeps activity details private", async () => {
		const t = convexTest(schema, modules);
		await expect(t.mutation(api.enduranceActivities.create, base)).rejects.toThrow("Unauthenticated");
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		const id = await alice.mutation(api.enduranceActivities.create, base);
		expect(await bob.query(api.enduranceActivities.get, { id })).toBeNull();
		await expect(bob.mutation(api.enduranceActivities.remove, { id })).rejects.toThrow("Activity not found");
		expect(await bob.query(api.activities.list, {})).toMatchObject({ items: [] });
	});

	it("creates one envelope and detail on retry, then edits and clears fields", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const id = await alice.mutation(api.enduranceActivities.create, { ...base, notes: "First", effort: 6 });
		expect(await alice.mutation(api.enduranceActivities.create, { ...base, notes: "First", effort: 6 })).toBe(id);
		await expect(alice.mutation(api.enduranceActivities.create, base)).rejects.toThrow("different details");
		await alice.mutation(api.enduranceActivities.update, { id, occurredAt: base.occurredAt, durationSeconds: 1500, distanceMeters: 6000, notes: null, effort: null });
		expect(await alice.query(api.enduranceActivities.get, { id })).toMatchObject({ distanceMeters: 6000, durationSeconds: 1500 });
		expect((await alice.query(api.enduranceActivities.get, { id }))?.notes).toBeUndefined();
		await alice.mutation(api.enduranceActivities.remove, { id });
		expect(await alice.query(api.enduranceActivities.get, { id })).toBeNull();
		const counts = await t.run(async (ctx) => ({
			activities: await ctx.db.query("activities").collect(),
			details: await ctx.db.query("enduranceActivityDetails").collect(),
		}));
		expect(counts).toEqual({ activities: [], details: [] });
	});

	it("paginates mixed history with identical times and excludes active strength sessions", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		for (let i = 0; i < 5; i++) {
			await alice.mutation(api.enduranceActivities.create, { ...base, clientEntryId: `run-${i}`, sport: i % 2 ? "cycling" : "running" });
		}
		const createdAtTimes = await t.run(async (ctx) =>
			(await ctx.db.query("activities").collect()).map((activity) => activity._creationTime),
		);
		expect(new Set(createdAtTimes).size).toBe(createdAtTimes.length);
		await alice.mutation(api.workoutSessions.create, {});
		const found: string[] = [];
		let cursor: string | null = null;
		for (let page = 0; page < 10; page++) {
			const result: { items: Array<{ id: string }>; cursor: string | null; isDone: boolean } = await alice.query(api.activities.list, { limit: 2, cursor });
			found.push(...result.items.map((item) => item.id));
			cursor = result.cursor;
			if (result.isDone) break;
		}
		expect(found).toHaveLength(5);
		expect(new Set(found).size).toBe(5);
		const cycling = await alice.query(api.activities.list, { sport: "cycling", from: base.occurredAt, to: base.occurredAt + 1 });
		expect(cycling.items).toHaveLength(2);
	});

	it("binds cursors to a user and refetches current rows after an edit or delete", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		const ids = [];
		for (let i = 0; i < 3; i++) {
			ids.push(await alice.mutation(api.enduranceActivities.create, { ...base, clientEntryId: `cursor-${i}`, occurredAt: base.occurredAt - i * 1000 }));
		}
		const first = await alice.query(api.activities.list, { limit: 1 });
		expect(first.items[0]?.id).toBe(ids[0]);
		await expect(bob.query(api.activities.list, { limit: 1, cursor: first.cursor })).rejects.toThrow("cursor");
		await alice.mutation(api.enduranceActivities.remove, { id: ids[1] });
		const second = await alice.query(api.activities.list, { limit: 1, cursor: first.cursor });
		expect(second.items[0]?.id).toBe(ids[2]);
	});

	it("includes endurance in the nutrition marker and JSON export", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const range = { from: base.occurredAt, to: base.occurredAt + 86_400_000 };
		expect(await alice.query(api.nutritionActivityMarker.hasCompletedActivity, range)).toBe(false);
		const id = await alice.mutation(api.enduranceActivities.create, base);
		expect(await alice.query(api.nutritionActivityMarker.hasCompletedActivity, range)).toBe(true);
		const exported = await alice.query(api.exportData.endurancePage, {});
		expect(exported.activities.map((item: { _id: string }) => item._id)).toEqual([id]);
		expect(exported.enduranceActivityDetails).toHaveLength(1);
	});

	it("exports all endurance records through bounded pages", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		for (let i = 0; i < 105; i++) {
			await alice.mutation(api.enduranceActivities.create, { ...base, clientEntryId: `export-${i}`, occurredAt: base.occurredAt + i });
		}
		await bob.mutation(api.enduranceActivities.create, { ...base, clientEntryId: "bob" });
		const first = await alice.query(api.exportData.endurancePage, {});
		expect(first.activities).toHaveLength(100);
		expect(first.enduranceActivityDetails).toHaveLength(100);
		expect(first.isDone).toBe(false);
		const second = await alice.query(api.exportData.endurancePage, { cursor: first.cursor });
		expect(second.activities).toHaveLength(5);
		expect(second.enduranceActivityDetails).toHaveLength(5);
		expect(second.isDone).toBe(true);
	});
});
