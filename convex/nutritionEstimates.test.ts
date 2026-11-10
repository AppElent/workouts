/// <reference types="vite/client" />
import {
	canonicalJson,
	normalizePersonalFood,
	personalFoodSnapshot,
} from "@foundry/core";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const nutrients = {
	energy: { kind: "value" as const, amount: 320 },
	protein: { kind: "trace" as const },
	carbs: { kind: "absent" as const },
	fat: { kind: "value" as const, amount: 3 },
	saturatedFat: { kind: "absent" as const },
	fibre: { kind: "trace" as const },
	sugars: { kind: "value" as const, amount: 2 },
	salt: { kind: "value" as const, amount: 0.1 },
};
const legacy = {
	id: "soup",
	name: { en: "Soup", nl: "Soep" },
	baseUnit: "g" as const,
	nutrients,
	servings: [],
	provenance: {
		recordOrigin: "personal" as const,
		nutritionSource: "manual" as const,
		locallyEdited: false,
	},
	createdAt: 1,
	updatedAt: 2,
};
const estimated = normalizePersonalFood({
	...legacy,
	classification: "recipe",
	baseUnit: "serving",
	estimated: true,
	nutritionBasis: { kind: "perServing", label: { en: "Bowl", nl: "Kom" } },
	description: { en: "Family soup", nl: "Familiesoep" },
});

function getMany(
	user: { query: ReturnType<typeof convexTest>["query"] },
	ids: string[],
) {
	return user.query(api.nutritionLibrary.getMany, { ids, photoVersion: 3 });
}

function upsert(
	operationId: string,
	expectedRevision: number,
	payload: unknown,
	schemaVersion?: 1 | 2 | 3,
) {
	return {
		version: 1 as const,
		expectedSubject: "alice",
		operationId,
		operation: {
			kind: "upsert" as const,
			expectedRevision,
			record: {
				id: "soup",
				kind: "food" as const,
				payload: JSON.stringify(payload),
				...(schemaVersion ? { schemaVersion } : {}),
			},
		},
	};
}

describe("Personal Food estimate compatibility", () => {
	it("reads pre-upgrade rows and replays pre-upgrade receipts without requiring a version backfill", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const oldOperation = upsert("pre-upgrade", 0, legacy);
		const oldRecord = {
			id: "soup",
			kind: "food" as const,
			payload: JSON.stringify(legacy),
			revision: 1,
			deleted: false,
		};
		await t.run(async (ctx) => {
			await ctx.db.insert("nutritionLibraryRecords", {
				userId: "alice",
				recordId: "soup",
				recordKind: "food",
				payload: oldRecord.payload,
				revision: 1,
				deleted: false,
				updatedAt: 1,
			});
			await ctx.db.insert("nutritionLibraryOperationReceipts", {
				userId: "alice",
				operationId: "pre-upgrade",
				createdAt: 1,
				payload: canonicalJson({
					version: oldOperation.version,
					expectedSubject: oldOperation.expectedSubject,
					operation: oldOperation.operation,
				}),
				result: JSON.stringify({ record: oldRecord }),
			});
		});
		expect(await getMany(alice, ["soup"])).toEqual([
			{ ...oldRecord, schemaVersion: 1, subject: "alice" },
		]);
		expect(
			await alice.mutation(api.nutritionLibrary.save, oldOperation),
		).toEqual({ record: oldRecord });
		const next = await alice.mutation(
			api.nutritionLibrary.save,
			upsert("legacy-update", 1, legacy),
		);
		expect(next.record).toMatchObject({ revision: 2, schemaVersion: 1 });
	});

	it("accepts legacy records, upgrades them, prevents older shapes from erasing fields, and keeps tombstones final", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(
			api.nutritionLibrary.save,
			upsert("old-create", 0, legacy),
		);
		await alice.mutation(
			api.nutritionLibrary.save,
			upsert("new-update", 1, estimated, 2),
		);
		const [upgraded] = await getMany(alice, ["soup"]);
		expect(upgraded).toMatchObject({ schemaVersion: 2, revision: 2 });
		expect(JSON.parse(upgraded.payload ?? "null")).toEqual(estimated);
		await expect(
			alice.mutation(api.nutritionLibrary.save, upsert("downgrade", 2, legacy)),
		).rejects.toMatchObject({
			data: { code: "invalid", field: "schemaVersion" },
		});
		await alice.mutation(api.nutritionLibrary.save, {
			version: 1,
			expectedSubject: "alice",
			operationId: "remove",
			operation: {
				kind: "remove",
				recordId: "soup",
				recordKind: "food",
				expectedRevision: 2,
			},
		});
		const removed = {
			payload: null,
			deleted: true,
			schemaVersion: 2,
			revision: 3,
		};
		expect((await getMany(alice, ["soup"]))[0]).toMatchObject(removed);
		for (const [operationId, payload, version] of [
			["old-restore", legacy, undefined],
			["restore", estimated, 2],
		] as const)
			await expect(
				alice.mutation(
					api.nutritionLibrary.save,
					upsert(operationId, 3, payload, version),
				),
			).rejects.toMatchObject({ data: { code: "recordDeleted" } });
		expect((await getMany(alice, ["soup"]))[0]).toMatchObject(removed);
		expect(
			(
				await alice.query(api.nutritionLibrary.browse, {
					query: "",
					paginationOpts: { cursor: null, numItems: 10 },
					photoVersion: 3,
				})
			).page,
		).toEqual([]);
	});

	it("requires the current payload schema for new fields and validates basis consistently", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("unversioned", 0, estimated),
			),
		).rejects.toMatchObject({
			data: { code: "invalid", field: "schemaVersion" },
		});
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("bad-unit", 0, { ...estimated, baseUnit: "g" }, 2),
			),
		).rejects.toMatchObject({
			data: { code: "unitMismatch", field: "nutritionBasis" },
		});
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("bad-estimate", 0, { ...estimated, estimated: "yes" }, 2),
			),
		).rejects.toMatchObject({
			data: { code: "invalid", field: "estimated" },
		});
	});

	it("round-trips estimate snapshots in Combo backups without discarding unknown nutrient states", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const combo = {
			id: "lunch",
			name: "Lunch",
			createdAt: 1,
			updatedAt: 2,
			parts: [
				{
					id: "soup-part",
					reference: { kind: "personal", foodId: "soup" },
					snapshot: personalFoodSnapshot(estimated, { quantity: 1 }),
				},
			],
		};
		const result = await alice.mutation(api.nutritionLibrary.save, {
			version: 1,
			expectedSubject: "alice",
			operationId: "combo",
			operation: {
				kind: "upsert",
				expectedRevision: 0,
				record: {
					id: "lunch",
					kind: "combo",
					schemaVersion: 2,
					payload: JSON.stringify(combo),
				},
			},
		});
		expect(JSON.parse(result.record.payload ?? "null")).toEqual(combo);
	});

	it("rejects negative Combo figures before they can poison an account restore", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const snapshot = personalFoodSnapshot(estimated, { quantity: 1 });
		const combo = {
			id: "invalid-combo",
			name: "Invalid Combo",
			createdAt: 1,
			updatedAt: 2,
			parts: [
				{
					id: "part",
					reference: { kind: "personal", foodId: "soup" },
					snapshot: {
						...snapshot,
						nutrients: {
							...snapshot.nutrients,
							energy: { kind: "value", amount: -1 },
						},
					},
				},
			],
		};
		await expect(
			alice.mutation(api.nutritionLibrary.save, {
				version: 1,
				expectedSubject: "alice",
				operationId: "invalid-combo",
				operation: {
					kind: "upsert",
					expectedRevision: 0,
					record: {
						id: combo.id,
						kind: "combo",
						schemaVersion: 2,
						payload: JSON.stringify(combo),
					},
				},
			}),
		).rejects.toMatchObject({
			data: {
				code: "negative",
				field: "parts.0.snapshot.nutrients.energy",
			},
		});
		expect(await getMany(alice, [combo.id])).toEqual([]);
	});

	it.each(["reference", "nutritionSource"])(
		"rejects an array masquerading as a Combo %s enum",
		async (field) => {
			const t = convexTest(schema, modules);
			const alice = t.withIdentity({ subject: "alice" });
			const snapshot = personalFoodSnapshot(estimated, { quantity: 1 });
			const combo = {
				id: "invalid-combo",
				name: "Invalid Combo",
				createdAt: 1,
				updatedAt: 2,
				parts: [
					{
						id: "part",
						reference: {
							kind: field === "reference" ? ["personal"] : "personal",
							foodId: "soup",
						},
						snapshot: {
							...snapshot,
							provenance: {
								...snapshot.provenance,
								...(field === "nutritionSource"
									? { nutritionSource: ["manual"] }
									: {}),
							},
						},
					},
				],
			};
			await expect(
				alice.mutation(api.nutritionLibrary.save, {
					version: 1,
					expectedSubject: "alice",
					operationId: `invalid-${field}`,
					operation: {
						kind: "upsert",
						expectedRevision: 0,
						record: {
							id: combo.id,
							kind: "combo",
							schemaVersion: 2,
							payload: JSON.stringify(combo),
						},
					},
				}),
			).rejects.toMatchObject({
				data: {
					code: "invalid",
					field:
						field === "reference"
							? "parts.0.reference"
							: "parts.0.snapshot.provenance.nutritionSource",
				},
			});
			expect(await getMany(alice, [combo.id])).toEqual([]);
		},
	);

	it.each(["classification", "estimated", "nutritionBasis"])(
		"rejects explicit null %s in versioned backup payloads",
		async (key) => {
			const t = convexTest(schema, modules);
			const alice = t.withIdentity({ subject: "alice" });
			await expect(
				alice.mutation(
					api.nutritionLibrary.save,
					upsert(`null-${key}`, 0, { ...estimated, [key]: null }, 2),
				),
			).rejects.toMatchObject({ data: { code: "invalid", field: key } });
		},
	);

	it("preserves estimates through logging workflows and aggregates their nutrient states in weekly review", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const snapshot = personalFoodSnapshot(estimated, {
			quantity: 1,
			date: "2026-09-14",
			meal: "lunch",
		});
		const first = await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "create-first",
			expectedSubject: "alice",
			operation: {
				kind: "create",
				entry: { ...snapshot, clientEntryId: "entry-0" },
			},
		});
		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "edit-move-first",
			expectedSubject: "alice",
			operation: {
				kind: "update",
				target: { kind: "serverId", id: first.entryIds[0] },
				quantity: 2,
				date: "2026-09-15",
				meal: "dinner",
			},
		});
		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "create",
			expectedSubject: "alice",
			operation: {
				kind: "create",
				entry: { ...snapshot, clientEntryId: "entry-1" },
			},
		});
		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "edit-move",
			expectedSubject: "alice",
			operation: {
				kind: "update",
				target: { kind: "clientEntryId", id: "entry-1" },
				quantity: 0.5,
				date: "2026-09-15",
			},
		});
		const day = await alice.query(api.nutritionDiary.day, {
			date: "2026-09-15",
		});
		expect(day.entries).toHaveLength(2);
		expect(
			day.entries.every(
				(entry) => entry.estimated && entry.baseUnit === "serving",
			),
		).toBe(true);
		const { _id, _creationTime, userId, loggedAt, ...copy } = day.entries[0];
		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "copy",
			expectedSubject: "alice",
			operation: {
				kind: "create",
				entry: { ...copy, clientEntryId: "copied", date: "2026-09-16" },
			},
		});
		const comboPart = personalFoodSnapshot(estimated, { quantity: 1 });
		await alice.mutation(api.nutritionDiary.applyOperation, {
			version: 1,
			operationId: "combo",
			expectedSubject: "alice",
			operation: {
				kind: "createBatch",
				date: "2026-09-16",
				meal: "lunch",
				entries: [
					{
						...comboPart,
						clientEntryId: "combo-entry",
						comboGroup: { id: "group", comboId: "lunch", name: "Lunch" },
					},
				],
			},
		});
		const week = await alice.query(api.nutritionReview.week, {
			startDate: "2026-09-14",
		});
		const loggedDays = week.days.filter((entry) => entry.entryCount > 0);
		expect(loggedDays.reduce((sum, entry) => sum + entry.entryCount, 0)).toBe(
			4,
		);
		expect(
			loggedDays.every(
				(entry) =>
					entry.totals.energy.incomplete === false &&
					// Every entry here is estimated, so every known total is approximate.
					entry.totals.energy.qualified === true &&
					entry.totals.protein.traceCount === entry.entryCount &&
					entry.totals.protein.qualified === true &&
					entry.totals.protein.incomplete === false &&
					entry.totals.carbs.absentCount === entry.entryCount &&
					entry.totals.carbs.incomplete === true,
			),
		).toBe(true);
	});
});
