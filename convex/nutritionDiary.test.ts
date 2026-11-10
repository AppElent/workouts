/// <reference types="vite/client" />
import type { FunctionArgs } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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

type Operation = FunctionArgs<
	typeof api.nutritionDiary.applyOperation
>["operation"];
type Entry = Omit<
	Extract<Operation, { kind: "create" }>["entry"],
	"clientEntryId"
>;
type Part = Omit<
	Extract<Operation, { kind: "createBatch" }>["entries"][number],
	"clientEntryId" | "comboGroup"
>;

/** A test deployment with per-account diary shorthands over `applyOperation`. */
function setup() {
	const t = convexTest(schema, modules);
	let sequence = 0;
	const as = (subject: string) => {
		const user = t.withIdentity({ subject });
		const apply = (operation: Operation) =>
			user.mutation(api.nutritionDiary.applyOperation, {
				version: 1,
				operationId: `${subject}-op-${++sequence}`,
				expectedSubject: subject,
				operation,
			});
		const target = (id: Id<"nutritionDiaryEntries">) => ({
			kind: "serverId" as const,
			id,
		});
		return {
			user,
			apply,
			log: async (entry: Entry) =>
				(
					await apply({
						kind: "create",
						entry: { ...entry, clientEntryId: `entry-${++sequence}` },
					})
				).entryIds[0],
			logCombo: async (args: {
				date: string;
				meal: Entry["meal"];
				combo: { id: string; name: string };
				parts: Part[];
			}) =>
				(
					await apply({
						kind: "createBatch",
						date: args.date,
						meal: args.meal,
						entries: args.parts.map((part) => ({
							...part,
							comboGroup: {
								id: `logged-${args.combo.id}`,
								comboId: args.combo.id,
								name: args.combo.name,
							},
							clientEntryId: `entry-${++sequence}`,
						})),
					})
				).entryIds,
			update: (
				id: Id<"nutritionDiaryEntries">,
				changes: Omit<
					Extract<Operation, { kind: "update" }>,
					"kind" | "target"
				>,
			) => apply({ kind: "update", target: target(id), ...changes }),
			remove: (id: Id<"nutritionDiaryEntries">) =>
				apply({ kind: "remove", target: target(id) }),
			day: (date: string) => user.query(api.nutritionDiary.day, { date }),
		};
	};
	return { t, as };
}

describe("public nutrition diary operations", () => {
	it("requires authentication and stores an immutable food snapshot", async () => {
		const { t, as } = setup();
		await expect(
			t.query(api.nutritionDiary.day, { date: snapshot.date }),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });
		await expect(
			t.mutation(api.nutritionDiary.applyOperation, {
				version: 1,
				operationId: "anonymous",
				expectedSubject: "alice",
				operation: {
					kind: "create",
					entry: { ...snapshot, clientEntryId: "anonymous" },
				},
			}),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });

		const alice = as("alice");
		await alice.log(snapshot);
		const day = await alice.day(snapshot.date);

		expect(day.entries).toHaveLength(1);
		expect(day.entries[0]).toMatchObject(snapshot);
		expect(day.totals.protein).toMatchObject({
			amount: 0,
			traceCount: 1,
			qualified: true,
		});
		expect(day.totals.fat).toMatchObject({
			amount: 0,
			absentCount: 1,
			incomplete: true,
		});
		expect(await alice.day("2026-09-04")).toMatchObject({ entries: [] });
		expect(await as("bob").day(snapshot.date)).toMatchObject({ entries: [] });
	});

	it("keeps a Personal Food snapshot renderable when its device reference is unavailable", async () => {
		const alice = setup().as("alice");
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

		await alice.log(personalSnapshot);
		personalSnapshot.name.en = "Changed only on the phone";
		const day = await alice.day(snapshot.date);

		expect(day.entries[0]).toMatchObject({
			name: { en: "Training oats", nl: "Trainingshavermout" },
			serving: { en: "Scoop × 1", nl: "Schep × 1" },
			provenance: {
				source: "personal",
				sourceId: "58b7a219-67e5-42fc-9400-d740e8837df8",
			},
		});
		expect(day.totals.energy).toMatchObject({
			amount: 111.375,
			incomplete: false,
		});
		expect(day.totals.protein).toMatchObject({
			amount: 0,
			traceCount: 1,
			qualified: true,
		});
		expect(day.totals.carbs).toMatchObject({
			amount: 0,
			absentCount: 1,
			incomplete: true,
		});
		expect(day.totals.sugars).toMatchObject({
			amount: 0,
			valueCount: 1,
			incomplete: false,
		});
	});

	it("rescales the stored snapshot on a quantity edit, never re-deriving it from a source", async () => {
		const alice = setup().as("alice");
		const id = await alice.log(snapshot);

		await alice.update(id, { quantity: 2 });
		const day = await alice.day(snapshot.date);

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
		const alice = setup().as("alice");
		const id = await alice.log(snapshot);

		await expect(alice.update(id, { quantity: 0 })).rejects.toMatchObject({
			data: { code: "notPositive", field: "quantity" },
		});
		const day = await alice.day(snapshot.date);
		expect(day.entries[0]).toMatchObject({ quantity: 1, amount: 135 });
	});

	it("moves an entry between meals, and both meals reflect it", async () => {
		const alice = setup().as("alice");
		const id = await alice.log(snapshot);

		await alice.update(id, { meal: "dinner" });
		const day = await alice.day(snapshot.date);

		expect(day.entries).toHaveLength(1);
		expect(day.entries[0].meal).toBe("dinner");
	});

	it("moves an entry to another date, and both days update", async () => {
		const alice = setup().as("alice");
		const id = await alice.log(snapshot);

		await alice.update(id, { date: "2026-09-06" });

		const oldDay = await alice.day(snapshot.date);
		const newDay = await alice.day("2026-09-06");
		expect(oldDay.entries).toHaveLength(0);
		expect(oldDay.totals.energy).toMatchObject({ amount: 0, entryCount: 0 });
		expect(newDay.entries).toHaveLength(1);
		expect(newDay.totals.energy).toMatchObject({ amount: 75.6 });
	});

	it("rejects an invalid date on an edit", async () => {
		const alice = setup().as("alice");
		const id = await alice.log(snapshot);

		await expect(
			alice.update(id, { date: "not-a-date" }),
		).rejects.toMatchObject({ data: { code: "invalid", field: "date" } });
		expect((await alice.day(snapshot.date)).entries).toHaveLength(1);
	});

	it("requires authentication and ownership to edit or delete an entry", async () => {
		const { t, as } = setup();
		const alice = as("alice");
		const id = await alice.log(snapshot);

		await expect(
			t.mutation(api.nutritionDiary.applyOperation, {
				version: 1,
				operationId: "anonymous-remove",
				expectedSubject: "alice",
				operation: { kind: "remove", target: { kind: "serverId", id } },
			}),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });

		const bob = as("bob");
		await expect(bob.update(id, { quantity: 2 })).rejects.toMatchObject({
			data: { code: "notFound", field: "target" },
		});
		await expect(bob.remove(id)).rejects.toMatchObject({
			data: { code: "notFound", field: "target" },
		});

		// Untouched by the rejected attempts.
		const day = await alice.day(snapshot.date);
		expect(day.entries).toHaveLength(1);
		expect(day.entries[0]).toMatchObject({ quantity: 1 });
	});

	it("deletes an entry so it disappears from the day's entries and totals", async () => {
		const alice = setup().as("alice");
		const id = await alice.log(snapshot);

		await alice.remove(id);
		const day = await alice.day(snapshot.date);

		expect(day.entries).toHaveLength(0);
		expect(day.totals.energy).toMatchObject({ amount: 0, entryCount: 0 });
	});

	it("logs every fixed Combo part in one action with one shared snapshotted group stamp", async () => {
		const alice = setup().as("alice");
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

		await alice.logCombo({
			date: "2026-09-07",
			meal: "breakfast",
			combo: {
				id: "6cbf4311-dca6-4917-aef0-40fe81345c0b",
				name: "Post-workout breakfast",
			},
			parts: [applePart, oatsPart],
		});
		const day = await alice.day("2026-09-07");

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
		const alice = setup().as("alice");
		const { date: _date, meal: _meal, ...part } = snapshot;

		const [firstId, secondId] = await alice.logCombo({
			date: snapshot.date,
			meal: "lunch",
			combo: { id: "deleted-local-combo", name: "Apple duo" },
			parts: [part, { ...part, name: { en: "Pear", nl: "Peer" } }],
		});

		await alice.update(firstId, { quantity: 2 });
		await alice.remove(secondId);
		const day = await alice.day(snapshot.date);

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
		const alice = setup().as("alice").user;
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

	it("groups surviving entries when a durable target contains a stale deployment id", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const created = await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "create-surviving-part",
			expectedSubject: "alice",
			operation: {
				kind: "create",
				entry: { ...snapshot, clientEntryId: "surviving-part" },
			},
		});

		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "group-with-stale-id",
			expectedSubject: "alice",
			operation: {
				kind: "group",
				targets: [
					{ kind: "serverId", id: created.entryIds[0] },
					{ kind: "serverId", id: "stale-deployment-entry-id" as never },
				],
				comboGroup: {
					id: "recovered-group",
					comboId: "combo-1",
					name: "Recovered combo",
				},
			},
		});

		const day = await alice.query(api.nutritionDiary.day, {
			date: snapshot.date,
		});
		expect(day.entries).toHaveLength(1);
		expect(day.entries[0].comboGroup).toEqual({
			id: "recovered-group",
			comboId: "combo-1",
			name: "Recovered combo",
		});
	});

	it("detaches one entry from its Logged Combo when it moves", async () => {
		const alice = setup().as("alice");
		const { date: _date, meal: _meal, ...part } = snapshot;
		const [id] = await alice.logCombo({
			date: snapshot.date,
			meal: "lunch",
			combo: { id: "combo-1", name: "Apple oats" },
			parts: [part],
		});

		await alice.update(id, { meal: "dinner" });
		const day = await alice.day(snapshot.date);

		expect(day.entries[0]).toMatchObject({ _id: id, meal: "dinner" });
		expect(day.entries[0].comboGroup).toBeUndefined();
	});

	it("retains Logged Combo membership when an entry is edited in place", async () => {
		const alice = setup().as("alice");
		const { date: _date, meal: _meal, ...part } = snapshot;
		const [id] = await alice.logCombo({
			date: snapshot.date,
			meal: "lunch",
			combo: { id: "combo-1", name: "Apple oats" },
			parts: [part],
		});

		await alice.update(id, {
			date: snapshot.date,
			meal: "lunch",
			quantity: snapshot.quantity * 2,
		});
		const day = await alice.day(snapshot.date);

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
		const { t, as } = setup();
		const alice = as("alice");
		// An entry logged before client entry ids existed.
		const legacyId = await t.run((ctx) =>
			ctx.db.insert("nutritionDiaryEntries", {
				...snapshot,
				userId: "alice",
				loggedAt: Date.now(),
			}),
		);
		const pendingId = await alice.log(snapshot);
		const [pendingClientId] = (await alice.day(snapshot.date)).entries
			.filter((entry) => entry._id === pendingId)
			.map((entry) => entry.clientEntryId);

		const grouped = await alice.apply({
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
		});

		expect(grouped.entryIds).toEqual([pendingId]);
		expect(grouped.clientEntryIds).toEqual([pendingClientId]);
		expect(
			(await alice.day(snapshot.date)).entries.map(
				(entry) => entry.comboGroup?.id,
			),
		).toEqual(["logged-combo-1", "logged-combo-1"]);
	});

	it("rejects regrouping only part of an existing Logged Combo", async () => {
		const alice = setup().as("alice");
		const { date: _date, meal: _meal, ...part } = snapshot;
		const ids = await alice.logCombo({
			date: snapshot.date,
			meal: snapshot.meal,
			combo: { id: "old-combo", name: "Old combo" },
			parts: [part, { ...part, name: { en: "Oats", nl: "Havermout" } }],
		});

		await expect(
			alice.apply({
				kind: "group",
				targets: [{ kind: "serverId", id: ids[0] }],
				comboGroup: {
					id: "new-group",
					comboId: "new-combo",
					name: "New combo",
				},
			}),
		).rejects.toMatchObject({
			data: { code: "partialCombo", field: "targets" },
		});
		const day = await alice.day(snapshot.date);
		expect(day.entries.map((entry) => entry.comboGroup?.comboId)).toEqual([
			"old-combo",
			"old-combo",
		]);
	});

	it("rejects mixed Meal Slots and never groups another user's entry", async () => {
		const { as } = setup();
		const alice = as("alice");
		const bob = as("bob");
		const lunchId = await alice.log(snapshot);
		const dinnerId = await alice.log({ ...snapshot, meal: "dinner" });
		const bobId = await bob.log(snapshot);
		const comboGroup = {
			id: "logged-combo-1",
			comboId: "combo-1",
			name: "Apple oats",
		};

		await expect(
			alice.apply({
				kind: "group",
				targets: [
					{ kind: "serverId", id: lunchId },
					{ kind: "serverId", id: dinnerId },
				],
				comboGroup,
			}),
		).rejects.toMatchObject({ data: { code: "invalid", field: "targets" } });
		expect(
			(await alice.day(snapshot.date)).entries.map((entry) => entry.comboGroup),
		).toEqual([undefined, undefined]);

		// Another account's entry resolves like a stale target and is skipped.
		await expect(
			alice.apply({
				kind: "group",
				targets: [{ kind: "serverId", id: bobId }],
				comboGroup,
			}),
		).rejects.toMatchObject({ data: { code: "invalid", field: "targets" } });
		const grouped = await alice.apply({
			kind: "group",
			targets: [
				{ kind: "serverId", id: lunchId },
				{ kind: "serverId", id: bobId },
			],
			comboGroup,
		});
		expect(grouped.entryIds).toEqual([lunchId]);
		expect(
			(await bob.day(snapshot.date)).entries[0].comboGroup,
		).toBeUndefined();
	});
});
