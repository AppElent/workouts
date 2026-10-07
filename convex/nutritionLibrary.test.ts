/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
type Args = FunctionArgs<typeof api.nutritionLibrary.applyOperation>;

const nutrients = {
	energy: { kind: "value" as const, amount: 12 }, protein: { kind: "trace" as const },
	carbs: { kind: "absent" as const }, fat: { kind: "value" as const, amount: 1 },
	saturatedFat: { kind: "absent" as const }, fibre: { kind: "trace" as const },
	sugars: { kind: "value" as const, amount: 2 }, salt: { kind: "value" as const, amount: 0.1 },
};

function food(id: string, name = "Oats") {
	return JSON.stringify({
		id, name: { en: name, nl: `${name} nl` }, baseUnit: "g", nutrients,
		servings: [{ label: { en: "Bowl", nl: "Kom" }, amount: 50 }],
		provenance: { recordOrigin: "personal", nutritionSource: "manual", locallyEdited: false },
		createdAt: 1, updatedAt: 1,
	});
}

function combo(id: string) {
	return JSON.stringify({
		id, name: "Breakfast", createdAt: 1, updatedAt: 1,
		parts: [{
			id: "part-1", reference: { kind: "oneOff" },
			snapshot: {
				name: { en: "Cinnamon", nl: "Kaneel" }, serving: { en: "Pinch", nl: "Snuf" },
				quantity: 1, amount: 1, baseUnit: "g", nutrients, provenance: { source: "oneOff" },
			},
		}],
	});
}

function upsert(operationId: string, id: string, expectedRevision: number, payload = food(id)): Args {
	return {
		version: 1, operationId, expectedSubject: "alice",
		operation: { kind: "upsert", record: { id, kind: "food", payload }, expectedRevision },
	};
}

describe("nutrition library account backup operations", () => {
    it("pages account browse and search and resolves only requested records", async () => {
        const t = convexTest(schema, modules);
        const alice = t.withIdentity({ subject: "alice" });
        for (let i = 0; i < 6; i++) await alice.mutation(api.nutritionLibrary.save, upsert(`seed-${i}`, `food-${i}`, 0, food(`food-${i}`, `Oats ${i}`)));
        const first = await alice.query(api.nutritionLibrary.browse, { query: "", paginationOpts: { cursor: null, numItems: 2 } });
        expect(first.page).toHaveLength(2);
        expect(first.isDone).toBe(false);
        const next = await alice.query(api.nutritionLibrary.browse, { query: "", paginationOpts: { cursor: first.continueCursor, numItems: 2 } });
        expect(next.page.map(r => r.id)).not.toEqual(first.page.map(r => r.id));
        expect((await alice.query(api.nutritionLibrary.browse, { query: "Oats", paginationOpts: { cursor: null, numItems: 2 } })).page).toHaveLength(2);
        const selected = await alice.query(api.nutritionLibrary.getMany, { ids: ["food-5", "missing"] });
        expect(selected.map(r => r.id)).toEqual(["food-5"]);
        expect(await t.withIdentity({ subject: "bob" }).query(api.nutritionLibrary.getMany, { ids: ["food-5"] })).toEqual([]);
    });

	it("migrates conflicting journals without losing either version and retries old receipts", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.nutritionLibrary.save, upsert("server", "conflict", 0, food("conflict", "Server")));
		const local = upsert("legacy-edit", "conflict", 0, food("conflict", "Device"));
		const result = await alice.mutation(api.nutritionLibrary.migrateOperation, local);
		expect(JSON.parse(result.record.payload!).name.en).toBe("Device");
		expect(result.preservedRecords).toHaveLength(1);
		expect(JSON.parse(result.preservedRecords![0].payload!).name.en).toContain("Server");
		expect(await alice.mutation(api.nutritionLibrary.migrateOperation, local)).toEqual(result);
		await alice.mutation(api.nutritionLibrary.save, { version: 1, expectedSubject: "alice", operationId: "delete-conflict", operation: { kind: "remove", recordId: "conflict", recordKind: "food", expectedRevision: 1 } });
		const recovered = await alice.mutation(api.nutritionLibrary.migrateOperation, upsert("legacy-after-delete", "conflict", 1));
		expect(recovered.record.deleted).toBe(true);
		expect(recovered.preservedRecords?.[0].deleted).toBe(false);
		const old = upsert("old-ack", "old", 0);
		const ack = await alice.mutation(api.nutritionLibrary.applyOperation, old);
		expect(await alice.mutation(api.nutritionLibrary.migrateOperation, old)).toEqual(ack);
	});
	it("preserves an older pending schema without downgrading the account record", async () => {
		const alice = convexTest(schema, modules).withIdentity({ subject: "alice" });
		const current = upsert("current-v2", "schema-conflict", 0, food("schema-conflict", "Current"));
		if (current.operation.kind !== "upsert") throw new Error("Fixture needs upsert");
		await alice.mutation(api.nutritionLibrary.save, { ...current, operation: { ...current.operation, record: { ...current.operation.record, schemaVersion: 2 } } });
		const pending = upsert("pending-v1", "schema-conflict", 1, food("schema-conflict", "Pending"));
		const result = await alice.mutation(api.nutritionLibrary.migrateOperation, pending);
		expect(result.record.schemaVersion).toBe(2);
		expect(JSON.parse(result.record.payload!).name.en).toBe("Current");
		expect(JSON.parse(result.preservedRecords![0].payload!).name.en).toContain("Pending");
		expect(await alice.mutation(api.nutritionLibrary.migrateOperation, pending)).toEqual(result);
	});
	it("online edits use server acceptance order and cannot resurrect deleted records", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.nutritionLibrary.save, upsert("create-online", "food-online", 0));
		await alice.mutation(api.nutritionLibrary.save, upsert("first-edit", "food-online", 1, food("food-online", "First")));
		const last = await alice.mutation(api.nutritionLibrary.save, upsert("last-edit", "food-online", 1, food("food-online", "Last")));
		expect(JSON.parse(last.record.payload!).name.en).toBe("Last");
		expect(await alice.mutation(api.nutritionLibrary.save, upsert("last-edit", "food-online", 1, food("food-online", "Last")))).toEqual(last);
		await alice.mutation(api.nutritionLibrary.save, {
			version: 1, operationId: "remove-online", expectedSubject: "alice",
			operation: { kind: "remove", recordId: "food-online", recordKind: "food", expectedRevision: 1 },
		});
		await expect(alice.mutation(api.nutritionLibrary.save, upsert("stale-edit", "food-online", 1))).rejects.toThrow("deleted");
		expect((await alice.query(api.nutritionLibrary.list, { paginationOpts: { cursor: null, numItems: 10 } })).page[0].deleted).toBe(true);
	});
	it("isolates accounts and deduplicates an identical canonical receipt", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		const first = await alice.mutation(api.nutritionLibrary.applyOperation, upsert("op-1", "food-1", 0));
		expect(await alice.mutation(api.nutritionLibrary.applyOperation, upsert("op-1", "food-1", 0))).toEqual(first);
		expect((await bob.query(api.nutritionLibrary.list, { paginationOpts: { cursor: null, numItems: 10 } })).page).toEqual([]);
		await expect(bob.mutation(api.nutritionLibrary.applyOperation, upsert("op-1", "food-1", 0))).rejects.toThrow("Subject mismatch");
	});

	it("validates full payloads, retains payload-free tombstones, and cannot change record kind", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await expect(alice.mutation(api.nutritionLibrary.applyOperation, upsert("bad", "food-1", 0, JSON.stringify({ id: "food-1" })))).rejects.toThrow("Food name");
		await alice.mutation(api.nutritionLibrary.applyOperation, upsert("create", "food-1", 0));
		await alice.mutation(api.nutritionLibrary.applyOperation, {
			version: 1, operationId: "delete", expectedSubject: "alice",
			operation: { kind: "remove", recordId: "food-1", recordKind: "food", expectedRevision: 1 },
		});
		const listed = await alice.query(api.nutritionLibrary.list, { paginationOpts: { cursor: null, numItems: 10 } });
		expect(listed.page).toEqual([expect.objectContaining({ id: "food-1", revision: 2, deleted: true, payload: null })]);
		await expect(alice.mutation(api.nutritionLibrary.applyOperation, upsert("old-update", "food-1", 1))).rejects.toThrow("Conflict");
		await expect(alice.mutation(api.nutritionLibrary.applyOperation, {
			version: 1, operationId: "kind-change", expectedSubject: "alice",
			operation: { kind: "upsert", record: { id: "food-1", kind: "combo", payload: combo("food-1") }, expectedRevision: 2 },
		})).rejects.toThrow("kind cannot change");
	});

	it("backs up semantic Food icons but rejects device-local photo paths", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const iconPayload = JSON.stringify({
			...JSON.parse(food("icon-food")),
			visual: { kind: "icon", preset: "fruit" },
		});
		await expect(
			alice.mutation(api.nutritionLibrary.applyOperation, {
				...upsert("icon", "icon-food", 0, iconPayload),
				operation: {
					kind: "upsert",
					expectedRevision: 0,
					record: {
						id: "icon-food",
						kind: "food",
						payload: iconPayload,
						schemaVersion: 2,
					},
				},
			}),
		).resolves.toBeDefined();

		const photoPayload = JSON.stringify({
			...JSON.parse(food("photo-food")),
			visual: { kind: "photo", uri: "file:///food-photos/private.jpg" },
		});
		await expect(
			alice.mutation(api.nutritionLibrary.applyOperation, {
				...upsert("photo", "photo-food", 0, photoPayload),
				operation: {
					kind: "upsert",
					expectedRevision: 0,
					record: {
						id: "photo-food",
						kind: "food",
						payload: photoPayload,
						schemaVersion: 2,
					},
				},
			}),
		).rejects.toThrow("cannot be backed up");
	});
});
