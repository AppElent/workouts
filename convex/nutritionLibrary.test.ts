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
});
