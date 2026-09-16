/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const snapshot = {
	date: "2026-09-05",
	meal: "lunch" as const,
	name: { en: "Apple", nl: "Appel" },
	serving: { en: "Piece × 1", nl: "Stuk × 1" },
	quantity: 1,
	amount: 135,
	baseUnit: "g" as const,
	nutrients: {
		energy: { kind: "value" as const, amount: 75.6 },
		protein: { kind: "trace" as const },
		carbs: { kind: "value" as const, amount: 15.12 },
		fat: { kind: "absent" as const },
		saturatedFat: { kind: "value" as const, amount: 0.135 },
		fibre: { kind: "value" as const, amount: 2.7 },
		sugars: { kind: "value" as const, amount: 13.5 },
		salt: { kind: "value" as const, amount: 0.01 },
	},
	provenance: {
		source: "shipped" as const,
		sourceId: "shipped:apple",
		dataset: "NEVO-online",
		edition: "2025/9.0",
		sourceCode: 123,
		sourceName: { en: "Apple raw", nl: "Appel rauw" },
		saltDerived: true,
	},
};

describe("public nutrition diary operations", () => {
	it("requires authentication and stores an immutable food snapshot", async () => {
		const t = convexTest(schema, modules);
		await expect(t.query(api.nutritionDiary.day, { date: snapshot.date })).rejects.toThrow(
			"Unauthenticated",
		);

		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.nutritionDiary.log, snapshot);
		const day = await alice.query(api.nutritionDiary.day, { date: snapshot.date });

		expect(day.entries).toHaveLength(1);
		expect(day.entries[0]).toMatchObject(snapshot);
		expect(day.totals.protein).toMatchObject({ amount: 0, traceCount: 1, qualified: true });
		expect(day.totals.fat).toMatchObject({ amount: 0, absentCount: 1, incomplete: true });
		expect(await alice.query(api.nutritionDiary.day, { date: "2026-09-04" })).toMatchObject({
			entries: [],
		});
		expect(await t.withIdentity({ subject: "bob" }).query(api.nutritionDiary.day, { date: snapshot.date })).toMatchObject({
			entries: [],
		});
	});

	it("keeps a Personal Food snapshot renderable when its device reference is unavailable", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const personalSnapshot = {
			...snapshot,
			name: { en: "Training oats", nl: "Trainingshavermout" },
			serving: { en: "Scoop × 1", nl: "Schep × 1" },
			amount: 30,
			nutrients: {
				energy: { kind: "value" as const, amount: 111.375 },
				protein: { kind: "trace" as const },
				carbs: { kind: "absent" as const },
				fat: { kind: "value" as const, amount: 2.25 },
				saturatedFat: { kind: "absent" as const },
				fibre: { kind: "value" as const, amount: 3.6 },
				sugars: { kind: "value" as const, amount: 0 },
				salt: { kind: "value" as const, amount: 0.003 },
			},
			provenance: {
				source: "personal" as const,
				sourceId: "58b7a219-67e5-42fc-9400-d740e8837df8",
				nutritionSource: "manual" as const,
				locallyEdited: false,
			},
		};

		await alice.mutation(api.nutritionDiary.log, personalSnapshot);
		personalSnapshot.name.en = "Changed only on the phone";
		const day = await alice.query(api.nutritionDiary.day, { date: snapshot.date });

		expect(day.entries[0]).toMatchObject({
			name: { en: "Training oats", nl: "Trainingshavermout" },
			serving: { en: "Scoop × 1", nl: "Schep × 1" },
			provenance: {
				source: "personal",
				sourceId: "58b7a219-67e5-42fc-9400-d740e8837df8",
			},
		});
		expect(day.totals.energy).toMatchObject({ amount: 111.375, incomplete: false });
		expect(day.totals.protein).toMatchObject({ amount: 0, traceCount: 1, qualified: true });
		expect(day.totals.carbs).toMatchObject({ amount: 0, absentCount: 1, incomplete: true });
		expect(day.totals.sugars).toMatchObject({ amount: 0, valueCount: 1, incomplete: false });
	});

	it("rescales the stored snapshot on a quantity edit, never re-deriving it from a source", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const id = await alice.mutation(api.nutritionDiary.log, snapshot);

		await alice.mutation(api.nutritionDiary.update, { id, quantity: 2 });
		const day = await alice.query(api.nutritionDiary.day, { date: snapshot.date });

		expect(day.entries[0]).toMatchObject({
			quantity: 2,
			amount: 270,
			serving: { en: "Piece × 2", nl: "Stuk × 2" },
			nutrients: {
				energy: { kind: "value", amount: 151.2 },
				protein: { kind: "trace" },
				fat: { kind: "absent" },
			},
		});
		// Provenance and name are untouched — a quantity edit never re-reads the food.
		expect(day.entries[0].provenance).toEqual(snapshot.provenance);
		expect(day.entries[0].name).toEqual(snapshot.name);
	});

	it("rejects a non-positive quantity without changing the entry", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const id = await alice.mutation(api.nutritionDiary.log, snapshot);

		await expect(alice.mutation(api.nutritionDiary.update, { id, quantity: 0 })).rejects.toThrow(
			"Quantity must be greater than zero.",
		);
		const day = await alice.query(api.nutritionDiary.day, { date: snapshot.date });
		expect(day.entries[0]).toMatchObject({ quantity: 1, amount: 135 });
	});

	it("moves an entry between meals, and both meals reflect it", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const id = await alice.mutation(api.nutritionDiary.log, snapshot);

		await alice.mutation(api.nutritionDiary.update, { id, meal: "dinner" });
		const day = await alice.query(api.nutritionDiary.day, { date: snapshot.date });

		expect(day.entries).toHaveLength(1);
		expect(day.entries[0].meal).toBe("dinner");
	});

	it("moves an entry to another date, and both days update", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const id = await alice.mutation(api.nutritionDiary.log, snapshot);

		await alice.mutation(api.nutritionDiary.update, { id, date: "2026-09-06" });

		const oldDay = await alice.query(api.nutritionDiary.day, { date: snapshot.date });
		const newDay = await alice.query(api.nutritionDiary.day, { date: "2026-09-06" });
		expect(oldDay.entries).toHaveLength(0);
		expect(oldDay.totals.energy).toMatchObject({ amount: 0, entryCount: 0 });
		expect(newDay.entries).toHaveLength(1);
		expect(newDay.totals.energy).toMatchObject({ amount: 75.6 });
	});

	it("rejects an invalid date on an edit", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const id = await alice.mutation(api.nutritionDiary.log, snapshot);

		await expect(
			alice.mutation(api.nutritionDiary.update, { id, date: "not-a-date" }),
		).rejects.toThrow("Invalid diary date.");
	});

	it("requires authentication and ownership to edit or delete an entry", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const id = await alice.mutation(api.nutritionDiary.log, snapshot);

		await expect(t.mutation(api.nutritionDiary.update, { id, quantity: 2 })).rejects.toThrow(
			"Unauthenticated",
		);
		await expect(t.mutation(api.nutritionDiary.remove, { id })).rejects.toThrow("Unauthenticated");

		const bob = t.withIdentity({ subject: "bob" });
		await expect(bob.mutation(api.nutritionDiary.update, { id, quantity: 2 })).rejects.toThrow(
			"Unauthorized",
		);
		await expect(bob.mutation(api.nutritionDiary.remove, { id })).rejects.toThrow("Unauthorized");

		// Untouched by the rejected attempts.
		const day = await alice.query(api.nutritionDiary.day, { date: snapshot.date });
		expect(day.entries).toHaveLength(1);
	});

	it("deletes an entry so it disappears from the day's entries and totals", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const id = await alice.mutation(api.nutritionDiary.log, snapshot);

		await alice.mutation(api.nutritionDiary.remove, { id });
		const day = await alice.query(api.nutritionDiary.day, { date: snapshot.date });

		expect(day.entries).toHaveLength(0);
		expect(day.totals.energy).toMatchObject({ amount: 0, entryCount: 0 });
	});

	it("logs every fixed Combo part in one action with one shared snapshotted group stamp", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const { date: _date, meal: _meal, ...applePart } = snapshot;
		const oatsPart = {
			...applePart,
			name: { en: "Training oats", nl: "Trainingshavermout" },
			serving: { en: "Bowl × 1", nl: "Kom × 1" },
			quantity: 1,
			amount: 75,
			provenance: {
				source: "personal" as const,
				sourceId: "5b129704-22d0-4af4-aeee-ee7388cc70df",
				nutritionSource: "manual" as const,
				locallyEdited: false,
			},
		};

		await alice.mutation(api.nutritionDiary.logCombo, {
			date: "2026-09-07",
			meal: "breakfast",
			combo: {
				id: "6cbf4311-dca6-4917-aef0-40fe81345c0b",
				name: "Post-workout breakfast",
			},
			parts: [applePart, oatsPart],
		});
		const day = await alice.query(api.nutritionDiary.day, {
			date: "2026-09-07",
		});

		expect(day.entries).toHaveLength(2);
		expect(day.entries.map((entry) => entry.meal)).toEqual([
			"breakfast",
			"breakfast",
		]);
		expect(new Set(day.entries.map((entry) => entry.comboGroup?.id)).size).toBe(
			1,
		);
		expect(day.entries[0].comboGroup).toMatchObject({
			comboId: "6cbf4311-dca6-4917-aef0-40fe81345c0b",
			name: "Post-workout breakfast",
		});
	});

	it("keeps grouped snapshots independently correctable after their local sources disappear", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const { date: _date, meal: _meal, ...part } = snapshot;

		await alice.mutation(api.nutritionDiary.logCombo, {
			date: snapshot.date,
			meal: "lunch",
			combo: { id: "deleted-local-combo", name: "Apple duo" },
			parts: [part, { ...part, name: { en: "Pear", nl: "Peer" } }],
		});
		let day = await alice.query(api.nutritionDiary.day, {
			date: snapshot.date,
		});
		const firstId = day.entries[0]._id;
		const secondId = day.entries[1]._id;

		await alice.mutation(api.nutritionDiary.update, {
			id: firstId,
			quantity: 2,
		});
		await alice.mutation(api.nutritionDiary.remove, { id: secondId });
		day = await alice.query(api.nutritionDiary.day, { date: snapshot.date });

		expect(day.entries).toHaveLength(1);
		expect(day.entries[0]).toMatchObject({
			name: { en: "Apple", nl: "Appel" },
			quantity: 2,
			comboGroup: {
				comboId: "deleted-local-combo",
				name: "Apple duo",
			},
		});
		expect(day.totals.energy).toMatchObject({ amount: 151.2, entryCount: 1 });
	});

	it("groups existing entries atomically and replays the same operation idempotently", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const { date: _date, meal: _meal, ...part } = snapshot;
		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "create-parts",
			expectedSubject: "alice",
			operation: {
				kind: "createBatch",
				date: snapshot.date,
				meal: "lunch",
				entries: [
					{ ...part, clientEntryId: "apple-entry" },
					{
						...part,
						name: { en: "Oats", nl: "Havermout" },
						clientEntryId: "oats-entry",
					},
				],
			},
		});
		const before = await alice.query(api.nutritionDiary.day, {
			date: snapshot.date,
		});
		const grouping = {
			version: 1 as const,
			operationId: "group-parts",
			expectedSubject: "alice",
			operation: {
				kind: "group" as const,
				targets: [
					{ kind: "clientEntryId" as const, id: "apple-entry" },
					{ kind: "clientEntryId" as const, id: "oats-entry" },
				],
				comboGroup: {
					id: "logged-combo-1",
					comboId: "combo-1",
					name: "Apple oats",
				},
			},
		};

		await alice.mutation(api.nutritionDiary.applyOperation, grouping);
		await alice.mutation(api.nutritionDiary.applyOperation, grouping);
		const after = await alice.query(api.nutritionDiary.day, {
			date: snapshot.date,
		});

		expect(after.entries.map((entry) => entry._id)).toEqual(
			before.entries.map((entry) => entry._id),
		);
		expect(after.entries.map((entry) => entry.comboGroup)).toEqual([
			{ id: "logged-combo-1", comboId: "combo-1", name: "Apple oats" },
			{ id: "logged-combo-1", comboId: "combo-1", name: "Apple oats" },
		]);
		expect(after.entries.map((entry) => entry.nutrients)).toEqual(
			before.entries.map((entry) => entry.nutrients),
		);
	});

	it("detaches one entry from its Logged Combo when it moves", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const { date: _date, meal: _meal, ...part } = snapshot;
		const [id] = await alice.mutation(api.nutritionDiary.logCombo, {
			date: snapshot.date,
			meal: "lunch",
			combo: { id: "combo-1", name: "Apple oats" },
			parts: [part],
		});

		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "move-part",
			expectedSubject: "alice",
			operation: {
				kind: "update",
				target: { kind: "serverId", id },
				meal: "dinner",
			},
		});
		const day = await alice.query(api.nutritionDiary.day, {
			date: snapshot.date,
		});

		expect(day.entries[0]).toMatchObject({ _id: id, meal: "dinner" });
		expect(day.entries[0].comboGroup).toBeUndefined();
	});

	it("retains Logged Combo membership when an entry is edited in place", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const { date: _date, meal: _meal, ...part } = snapshot;
		const [id] = await alice.mutation(api.nutritionDiary.logCombo, {
			date: snapshot.date,
			meal: "lunch",
			combo: { id: "combo-1", name: "Apple oats" },
			parts: [part],
		});

		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "edit-part",
			expectedSubject: "alice",
			operation: {
				kind: "update",
				target: { kind: "serverId", id },
				date: snapshot.date,
				meal: "lunch",
				quantity: snapshot.quantity * 2,
			},
		});
		const day = await alice.query(api.nutritionDiary.day, {
			date: snapshot.date,
		});

		expect(day.entries[0]).toMatchObject({
			_id: id,
			quantity: snapshot.quantity * 2,
			comboGroup: {
				id: expect.any(String),
				comboId: "combo-1",
				name: "Apple oats",
			},
		});
	});

	it("keeps mixed legacy and pending identity mappings aligned when grouping", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const legacyId = await alice.mutation(api.nutritionDiary.log, snapshot);
		const created = await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "create-pending-part",
			expectedSubject: "alice",
			operation: {
				kind: "create",
				entry: { ...snapshot, clientEntryId: "pending-part" },
			},
		});
		const pendingId = created.entryIds[0];

		const grouped = await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "group-mixed-identities",
			expectedSubject: "alice",
			operation: {
				kind: "group",
				targets: [
					{ kind: "serverId", id: legacyId },
					{ kind: "serverId", id: pendingId },
				],
				comboGroup: {
					id: "logged-combo-1",
					comboId: "combo-1",
					name: "Apple oats",
				},
			},
		});

		expect(grouped.entryIds).toEqual([pendingId]);
		expect(grouped.clientEntryIds).toEqual(["pending-part"]);
	});

	it("rejects regrouping only part of an existing Logged Combo", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const { date: _date, meal: _meal, ...part } = snapshot;
		const ids = await alice.mutation(api.nutritionDiary.logCombo, {
			date: snapshot.date,
			meal: snapshot.meal,
			combo: { id: "old-combo", name: "Old combo" },
			parts: [
				part,
				{ ...part, name: { en: "Oats", nl: "Havermout" } },
			],
		});

		await expect(
			alice.mutation(api.nutritionDiary.applyOperation, {
				version: 1,
				operationId: "partial-regroup",
				expectedSubject: "alice",
				operation: {
					kind: "group",
					targets: [{ kind: "serverId", id: ids[0] }],
					comboGroup: {
						id: "new-group",
						comboId: "new-combo",
						name: "New combo",
					},
				},
			}),
		).rejects.toThrow("selected as a whole");
		const day = await alice.query(api.nutritionDiary.day, {
			date: snapshot.date,
		});
		expect(day.entries.map((entry) => entry.comboGroup?.comboId)).toEqual([
			"old-combo",
			"old-combo",
		]);
	});

	it("rejects mixed Meal Slots and another user's entry without partial grouping", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		const lunchId = await alice.mutation(api.nutritionDiary.log, snapshot);
		const dinnerId = await alice.mutation(api.nutritionDiary.log, {
			...snapshot,
			meal: "dinner",
		});
		const bobId = await bob.mutation(api.nutritionDiary.log, snapshot);
		const comboGroup = {
			id: "logged-combo-1",
			comboId: "combo-1",
			name: "Apple oats",
		};

		await expect(
			alice.mutation(api.nutritionDiary.applyOperation, {
				version: 1,
				operationId: "mixed-meals",
				expectedSubject: "alice",
				operation: {
					kind: "group",
					targets: [
						{ kind: "serverId", id: lunchId },
						{ kind: "serverId", id: dinnerId },
					],
					comboGroup,
				},
			}),
		).rejects.toThrow("share one date and Meal Slot");
		await expect(
			alice.mutation(api.nutritionDiary.applyOperation, {
				version: 1,
				operationId: "other-user",
				expectedSubject: "alice",
				operation: {
					kind: "group",
					targets: [
						{ kind: "serverId", id: lunchId },
						{ kind: "serverId", id: bobId },
					],
					comboGroup,
				},
			}),
		).rejects.toThrow("Unauthorized");

		const day = await alice.query(api.nutritionDiary.day, {
			date: snapshot.date,
		});
		expect(day.entries.map((entry) => entry.comboGroup)).toEqual([
			undefined,
			undefined,
		]);
	});
});
