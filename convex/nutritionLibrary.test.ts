/// <reference types="vite/client" />

import { LIBRARY_GET_MANY_LIMIT, LIBRARY_SCHEMA_VERSION } from "@foundry/core";
import type { FunctionArgs } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
type Args = FunctionArgs<typeof api.nutritionLibrary.save>;

const nutrients = {
	energy: { kind: "value" as const, amount: 12 },
	protein: { kind: "trace" as const },
	carbs: { kind: "absent" as const },
	fat: { kind: "value" as const, amount: 1 },
	saturatedFat: { kind: "absent" as const },
	fibre: { kind: "trace" as const },
	sugars: { kind: "value" as const, amount: 2 },
	salt: { kind: "value" as const, amount: 0.1 },
};

function food(id: string, name = "Oats") {
	return JSON.stringify({
		id,
		name: { en: name, nl: `${name} nl` },
		baseUnit: "g",
		nutrients,
		servings: [{ label: { en: "Bowl", nl: "Kom" }, amount: 50 }],
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
		},
		createdAt: 1,
		updatedAt: 1,
	});
}

function combo(id: string) {
	return JSON.stringify({
		id,
		name: "Breakfast",
		createdAt: 1,
		updatedAt: 1,
		parts: [
			{
				id: "part-1",
				reference: { kind: "oneOff" },
				snapshot: {
					name: { en: "Cinnamon", nl: "Kaneel" },
					serving: { en: "Pinch", nl: "Snuf" },
					quantity: 1,
					amount: 1,
					baseUnit: "g",
					nutrients,
					provenance: { source: "oneOff" },
				},
			},
		],
	});
}

function upsert(
	operationId: string,
	id: string,
	expectedRevision: number,
	payload = food(id),
): Args {
	return {
		operationId,
		expectedSubject: "alice",
		operation: {
			kind: "upsert",
			record: { id, kind: "food", payload },
			expectedRevision,
		},
	};
}

function remove(
	operationId: string,
	recordId: string,
	expectedRevision: number,
): Args {
	return {
		operationId,
		expectedSubject: "alice",
		operation: {
			kind: "remove",
			recordId,
			recordKind: "food",
			expectedRevision,
		},
	};
}

describe("nutrition library account backup operations", () => {
	it("pages account browse and search and resolves only requested records", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		for (let i = 0; i < 6; i++)
			await alice.mutation(
				api.nutritionLibrary.save,
				upsert(`seed-${i}`, `food-${i}`, 0, food(`food-${i}`, `Oats ${i}`)),
			);
		await alice.mutation(
			api.nutritionLibrary.save,
			remove("drop", "food-0", 1),
		);
		const first = await alice.query(api.nutritionLibrary.browse, {
			query: "",
			paginationOpts: { cursor: null, numItems: 2 },
		});
		expect(first.page).toHaveLength(2);
		expect(first.isDone).toBe(false);
		const next = await alice.query(api.nutritionLibrary.browse, {
			query: "",
			paginationOpts: { cursor: first.continueCursor, numItems: 2 },
		});
		expect(next.page.map((r) => r.id)).not.toEqual(first.page.map((r) => r.id));
		const all = await alice.query(api.nutritionLibrary.browse, {
			query: "",
			paginationOpts: { cursor: null, numItems: 10 },
		});
		expect(all.page.map((r) => r.id).sort()).toEqual([
			"food-1",
			"food-2",
			"food-3",
			"food-4",
			"food-5",
		]);
		expect(all.page[0]).toMatchObject({ subject: "alice", deleted: false });
		expect(
			(
				await alice.query(api.nutritionLibrary.browse, {
					query: "Oats",
					paginationOpts: { cursor: null, numItems: 2 },
				})
			).page,
		).toHaveLength(2);
		const selected = await alice.query(api.nutritionLibrary.getMany, {
			ids: ["food-5", "missing"],
		});
		expect(selected.map((r) => r.id)).toEqual(["food-5"]);
		expect(
			await t
				.withIdentity({ subject: "bob" })
				.query(api.nutritionLibrary.getMany, { ids: ["food-5"] }),
		).toEqual([]);
		await expect(
			alice.query(api.nutritionLibrary.browse, {
				query: "x".repeat(201),
				paginationOpts: { cursor: null, numItems: 2 },
			}),
		).rejects.toMatchObject({ data: { code: "tooLong", field: "query" } });
		await expect(
			alice.query(api.nutritionLibrary.getMany, {
				ids: Array.from(
					{ length: LIBRARY_GET_MANY_LIMIT + 1 },
					(_, i) => `food-${i}`,
				),
			}),
		).rejects.toMatchObject({ data: { code: "tooLarge", field: "ids" } });
		await expect(
			alice.query(api.nutritionLibrary.getMany, {
				ids: [],
				forkIds: Array.from(
					{ length: LIBRARY_GET_MANY_LIMIT + 1 },
					(_, i) => `food-${i}`,
				),
			}),
		).rejects.toMatchObject({ data: { code: "tooLarge", field: "forkIds" } });
		await expect(
			t.query(api.nutritionLibrary.browse, {
				query: "",
				paginationOpts: { cursor: null, numItems: 2 },
			}),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });
	});

	it("serves a stored record written before schema versions and stamps the current version on its next write", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await t.run((ctx) =>
			ctx.db.insert("nutritionLibraryRecords", {
				userId: "alice",
				recordId: "legacy",
				recordKind: "food",
				payload: food("legacy"),
				revision: 1,
				deleted: false,
				updatedAt: 1,
			}),
		);
		expect(
			await alice.query(api.nutritionLibrary.getMany, { ids: ["legacy"] }),
		).toEqual([expect.objectContaining({ schemaVersion: 1, revision: 1 })]);
		const next = await alice.mutation(
			api.nutritionLibrary.save,
			upsert("edit-legacy", "legacy", 1, food("legacy", "Edited")),
		);
		expect(next.record).toMatchObject({
			schemaVersion: LIBRARY_SCHEMA_VERSION,
			revision: 2,
		});
	});

	it("online edits use server acceptance order and cannot resurrect deleted records", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(
			api.nutritionLibrary.save,
			upsert("create-online", "food-online", 0),
		);
		await alice.mutation(
			api.nutritionLibrary.save,
			upsert("first-edit", "food-online", 1, food("food-online", "First")),
		);
		const last = await alice.mutation(
			api.nutritionLibrary.save,
			upsert("last-edit", "food-online", 1, food("food-online", "Last")),
		);
		expect(last.record.revision).toBe(3);
		expect(JSON.parse(last.record.payload!).name.en).toBe("Last");
		expect(
			await alice.mutation(
				api.nutritionLibrary.save,
				upsert("last-edit", "food-online", 1, food("food-online", "Last")),
			),
		).toEqual(last);
		await alice.mutation(
			api.nutritionLibrary.save,
			remove("remove-online", "food-online", 1),
		);
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("stale-edit", "food-online", 1),
			),
		).rejects.toMatchObject({ data: { code: "recordDeleted" } });
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("never-created", "food-missing", 1),
			),
		).rejects.toMatchObject({ data: { code: "recordDeleted" } });
		expect(
			await alice.query(api.nutritionLibrary.getMany, {
				ids: ["food-online", "food-missing"],
			}),
		).toEqual([
			expect.objectContaining({
				id: "food-online",
				revision: 4,
				deleted: true,
			}),
		]);
	});

	it("isolates accounts and deduplicates an identical canonical receipt", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		const first = await alice.mutation(
			api.nutritionLibrary.save,
			upsert("op-1", "food-1", 0),
		);
		expect(
			await alice.mutation(
				api.nutritionLibrary.save,
				upsert("op-1", "food-1", 0),
			),
		).toEqual(first);
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("op-1", "food-1", 0, food("food-1", "Changed")),
			),
		).rejects.toMatchObject({ data: { code: "operationConflict" } });
		expect(
			(
				await bob.query(api.nutritionLibrary.browse, {
					query: "",
					paginationOpts: { cursor: null, numItems: 10 },
				})
			).page,
		).toEqual([]);
		await expect(
			bob.mutation(api.nutritionLibrary.save, upsert("op-1", "food-1", 0)),
		).rejects.toMatchObject({ data: { code: "accountChanged" } });
		await expect(
			t.mutation(api.nutritionLibrary.save, upsert("op-1", "food-1", 0)),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });
	});

	it("validates full payloads, retains payload-free tombstones, and cannot change record kind", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		for (const [args, code, field] of [
			[
				upsert("bad", "food-1", 0, JSON.stringify({ id: "food-1" })),
				"required",
				"name.en",
			],
			[upsert("json", "food-1", 0, "{"), "invalid", "payload"],
			[upsert("empty", "food-1", 0, ""), "invalid", "payload"],
			[upsert("other-id", "food-1", 0, food("food-2")), "invalid", "id"],
			[upsert("blank-id", " ", 0), "invalid", "id"],
			[upsert("negative", "food-1", -1), "invalid", "expectedRevision"],
			[upsert("fraction", "food-1", 0.5), "invalid", "expectedRevision"],
		] as const) {
			await expect(
				alice.mutation(api.nutritionLibrary.save, args),
			).rejects.toMatchObject({ data: { code, field } });
		}
		await alice.mutation(
			api.nutritionLibrary.save,
			upsert("create", "food-1", 0),
		);
		await alice.mutation(
			api.nutritionLibrary.save,
			remove("delete", "food-1", 1),
		);
		expect(
			await alice.query(api.nutritionLibrary.getMany, {
				ids: ["food-1"],
			}),
		).toEqual([
			expect.objectContaining({
				id: "food-1",
				revision: 2,
				deleted: true,
				payload: null,
			}),
		]);
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("old-update", "food-1", 2),
			),
		).rejects.toMatchObject({ data: { code: "recordDeleted" } });
		await expect(
			alice.mutation(api.nutritionLibrary.save, {
				operationId: "kind-change",
				expectedSubject: "alice",
				operation: {
					kind: "upsert",
					record: { id: "food-1", kind: "combo", payload: combo("food-1") },
					expectedRevision: 2,
				},
			}),
		).rejects.toMatchObject({ data: { code: "invalid", field: "kind" } });
	});

	it("backs up semantic Food icons but rejects device-local photo paths", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const iconPayload = JSON.stringify({
			...JSON.parse(food("icon-food")),
			visual: { kind: "icon", preset: "fruit" },
		});
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("icon", "icon-food", 0, iconPayload),
			),
		).resolves.toBeDefined();

		const photoPayload = JSON.stringify({
			...JSON.parse(food("photo-food")),
			visual: { kind: "photo", uri: "file:///food-photos/private.jpg" },
		});
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("photo", "photo-food", 0, photoPayload),
			),
		).rejects.toMatchObject({ data: { code: "invalid", field: "visual" } });
		const remotePayload = JSON.stringify({
			...JSON.parse(food("remote-food")),
			visual: { kind: "remote", uri: "https://example.com/oats.jpg" },
		});
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("remote", "remote-food", 0, remotePayload),
			),
		).rejects.toMatchObject({ data: { code: "invalid", field: "visual" } });
		expect(
			await alice.query(api.nutritionLibrary.getMany, {
				ids: ["photo-food", "remote-food"],
			}),
		).toEqual([]);
	});
});
