/// <reference types="vite/client" />
import { normalizePersonalFood, personalFoodSnapshot } from "@foundry/core";
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
const soup = {
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
	...soup,
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
	return user.query(api.nutritionLibrary.getMany, { ids });
}

function upsert(
	operationId: string,
	expectedRevision: number,
	payload: unknown,
) {
	return {
		expectedSubject: "alice",
		operationId,
		operation: {
			kind: "upsert" as const,
			expectedRevision,
			record: {
				id: "soup",
				kind: "food" as const,
				payload: JSON.stringify(payload),
			},
		},
	};
}

describe("Personal Food estimates", () => {
	it("stores estimated Personal Food fields unchanged and validates basis consistently", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(
			api.nutritionLibrary.save,
			upsert("create", 0, estimated),
		);
		const [stored] = await getMany(alice, ["soup"]);
		expect(JSON.parse(stored.payload ?? "null")).toEqual(estimated);
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("bad-unit", 1, { ...estimated, baseUnit: "g" }),
			),
		).rejects.toMatchObject({
			data: { code: "unitMismatch", field: "nutritionBasis" },
		});
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				upsert("bad-estimate", 1, { ...estimated, estimated: "yes" }),
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
			expectedSubject: "alice",
			operationId: "combo",
			operation: {
				kind: "upsert",
				expectedRevision: 0,
				record: {
					id: "lunch",
					kind: "combo",
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
				expectedSubject: "alice",
				operationId: "invalid-combo",
				operation: {
					kind: "upsert",
					expectedRevision: 0,
					record: {
						id: combo.id,
						kind: "combo",
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
					expectedSubject: "alice",
					operationId: `invalid-${field}`,
					operation: {
						kind: "upsert",
						expectedRevision: 0,
						record: {
							id: combo.id,
							kind: "combo",
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
		"rejects explicit null %s in backup payloads",
		async (key) => {
			const t = convexTest(schema, modules);
			const alice = t.withIdentity({ subject: "alice" });
			await expect(
				alice.mutation(
					api.nutritionLibrary.save,
					upsert(`null-${key}`, 0, { ...estimated, [key]: null }),
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
