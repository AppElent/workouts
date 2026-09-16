/// <reference types="vite/client" />
import { normalizePersonalFood, personalFoodSnapshot } from "@workouts/core";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const nutrients = {
	energy: { kind: "value" as const, amount: 320 }, protein: { kind: "trace" as const },
	carbs: { kind: "absent" as const }, fat: { kind: "value" as const, amount: 3 },
	saturatedFat: { kind: "absent" as const }, fibre: { kind: "trace" as const },
	sugars: { kind: "value" as const, amount: 2 }, salt: { kind: "value" as const, amount: 0.1 },
};
const legacy = {
	id: "soup", name: { en: "Soup", nl: "Soep" }, baseUnit: "g" as const, nutrients, servings: [],
	provenance: { recordOrigin: "personal" as const, nutritionSource: "manual" as const, locallyEdited: false },
	createdAt: 1, updatedAt: 2,
};
const estimated = normalizePersonalFood({
	...legacy, classification: "recipe", baseUnit: "serving", estimated: true,
	nutritionBasis: { kind: "perServing", label: { en: "Bowl", nl: "Kom" } },
	description: { en: "Family soup", nl: "Familiesoep" },
});

function upsert(operationId: string, expectedRevision: number, payload: unknown, schemaVersion?: 1 | 2) {
	return {
		version: 1 as const, expectedSubject: "alice", operationId,
		operation: { kind: "upsert" as const, expectedRevision, record: { id: "soup", kind: "food" as const, payload: JSON.stringify(payload), ...(schemaVersion ? { schemaVersion } : {}) } },
	};
}

describe("Personal Food estimate compatibility", () => {
	it("accepts legacy records, upgrades them, and prevents older shapes from erasing fields", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.nutritionLibrary.applyOperation, upsert("old-create", 0, legacy));
		await alice.mutation(api.nutritionLibrary.applyOperation, upsert("new-update", 1, estimated, 2));
		const page = await alice.query(api.nutritionLibrary.list, { paginationOpts: { cursor: null, numItems: 10 } });
		expect(page.page[0].schemaVersion).toBe(2);
		expect(JSON.parse(page.page[0].payload ?? "null")).toEqual(estimated);
		await expect(alice.mutation(api.nutritionLibrary.applyOperation, upsert("stale", 1, legacy))).rejects.toThrow("Conflict");
		await expect(alice.mutation(api.nutritionLibrary.applyOperation, upsert("downgrade", 2, legacy))).rejects.toThrow("downgrade rejected");
		await alice.mutation(api.nutritionLibrary.applyOperation, {
			version: 1, expectedSubject: "alice", operationId: "remove",
			operation: { kind: "remove", recordId: "soup", recordKind: "food", expectedRevision: 2 },
		});
		const removed = await alice.query(api.nutritionLibrary.list, { paginationOpts: { cursor: null, numItems: 10 } });
		expect(removed.page[0]).toMatchObject({ payload: null, deleted: true, schemaVersion: 2, revision: 3 });
		await expect(alice.mutation(api.nutritionLibrary.applyOperation, upsert("old-restore", 3, legacy))).rejects.toThrow("downgrade rejected");
		await alice.mutation(api.nutritionLibrary.applyOperation, upsert("restore", 3, estimated, 2));
		expect(JSON.parse((await alice.query(api.nutritionLibrary.list, { paginationOpts: { cursor: null, numItems: 10 } })).page[0].payload ?? "null")).toEqual(estimated);
	});

	it("requires the current payload schema for new fields and validates basis consistently", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await expect(alice.mutation(api.nutritionLibrary.applyOperation, upsert("unversioned", 0, estimated))).rejects.toThrow("schema version 2");
		await expect(alice.mutation(api.nutritionLibrary.applyOperation, upsert("bad-unit", 0, { ...estimated, baseUnit: "g" }, 2))).rejects.toThrow("base unit");
		await expect(alice.mutation(api.nutritionLibrary.applyOperation, upsert("bad-estimate", 0, { ...estimated, estimated: "yes" }, 2))).rejects.toThrow("estimate status");
	});

	it("round-trips estimate snapshots in Combo backups without discarding unknown nutrient states", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const combo = { id: "lunch", name: "Lunch", createdAt: 1, updatedAt: 2, parts: [{ id: "soup-part", reference: { kind: "personal", foodId: "soup" }, snapshot: personalFoodSnapshot(estimated, { quantity: 1 }) }] };
		const result = await alice.mutation(api.nutritionLibrary.applyOperation, {
			version: 1, expectedSubject: "alice", operationId: "combo",
			operation: { kind: "upsert", expectedRevision: 0, record: { id: "lunch", kind: "combo", schemaVersion: 2, payload: JSON.stringify(combo) } },
		});
		expect(JSON.parse(result.record.payload ?? "null")).toEqual(combo);
	});

	it("preserves estimates through legacy and queued logging, edit, move, copy and weekly review", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const snapshot = personalFoodSnapshot(estimated, { quantity: 1, date: "2026-09-14", meal: "lunch" });
		const legacyId = await alice.mutation(api.nutritionDiary.log, snapshot);
		await alice.mutation(api.nutritionDiary.update, { id: legacyId, quantity: 2, date: "2026-09-15", meal: "dinner" });
		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1, operationId: "create", expectedSubject: "alice",
			operation: { kind: "create", entry: { ...snapshot, clientEntryId: "entry-1" } },
		});
		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1, operationId: "edit-move", expectedSubject: "alice",
			operation: { kind: "update", target: { kind: "clientEntryId", id: "entry-1" }, quantity: 0.5, date: "2026-09-15" },
		});
		const day = await alice.query(api.nutritionDiary.day, { date: "2026-09-15" });
		expect(day.entries).toHaveLength(2);
		expect(day.entries.every((entry) => entry.estimated && entry.baseUnit === "serving")).toBe(true);
		const { _id, _creationTime, userId, loggedAt, ...copy } = day.entries[0];
		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1, operationId: "copy", expectedSubject: "alice",
			operation: { kind: "create", entry: { ...copy, clientEntryId: "copied", date: "2026-09-16" } },
		});
		const comboPart = personalFoodSnapshot(estimated, { quantity: 1 });
		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1, operationId: "combo", expectedSubject: "alice",
			operation: { kind: "createBatch", date: "2026-09-16", meal: "lunch", entries: [{ ...comboPart, clientEntryId: "combo-entry", comboGroup: { id: "group", comboId: "lunch", name: "Lunch" } }] },
		});
		const week = await alice.query(api.nutritionReview.week, { startDate: "2026-09-14" });
		const entries = week.days.flatMap((entry) => entry.entries);
		expect(entries).toHaveLength(4);
		expect(entries.every((entry) => entry.estimated === true && entry.baseUnit === "serving")).toBe(true);
		expect(entries.every((entry) => entry.nutrients.protein.kind === "trace" && entry.nutrients.carbs.kind === "absent")).toBe(true);
	});
});
