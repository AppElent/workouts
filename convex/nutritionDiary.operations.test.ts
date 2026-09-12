/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { NutritionDiarySnapshot } from "@workouts/core";
import type { FunctionArgs } from "convex/server";
import { api } from "./_generated/api";
import schema from "./schema";

type ApplyOperationArgs = FunctionArgs<typeof api.nutritionDiary.applyOperation>;

const modules = import.meta.glob("./**/*.*s");

function snapshot(
	overrides: Record<string, unknown> = {},
): NutritionDiarySnapshot & { clientEntryId: string } {
	return {
		date: "2026-09-05",
		meal: "lunch" as const,
		clientEntryId: "client-entry-1",
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
		...overrides,
	} as NutritionDiarySnapshot & { clientEntryId: string };
}

function envelope(
	operationId: string,
	operation: ApplyOperationArgs["operation"],
	expectedSubject = "alice",
	): ApplyOperationArgs {
	return { version: 1 as const, operationId, expectedSubject, operation };
}

describe("retry-safe nutrition diary operations", () => {
	it("deduplicates identical create replay and rejects a changed payload", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const first = await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-create", { kind: "create", entry: snapshot() }),
		});
		const replay = await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-create", { kind: "create", entry: snapshot() }),
		});

		expect(replay).toEqual(first);
		expect((await alice.query(api.nutritionDiary.day, { date: "2026-09-05" })).entries).toHaveLength(1);
		expect(
			alice.mutation(api.nutritionDiary.applyOperation, {
				...envelope("op-create", {
					kind: "create",
					entry: snapshot({ quantity: 2 }),
				}),
			}),
		).rejects.toThrow("different payload");
	});

	it("keeps two intentional operations distinct and protects client ids", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-one", { kind: "create", entry: snapshot() }),
		});
		await expect(
			alice.mutation(api.nutritionDiary.applyOperation, {
				...envelope("op-two", { kind: "create", entry: snapshot() }),
			}),
		).rejects.toThrow("Client entry ID already exists");
		await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-three", {
				kind: "create",
				entry: snapshot({ clientEntryId: "client-entry-2" }),
			}),
		});
		expect((await alice.query(api.nutritionDiary.day, { date: "2026-09-05" })).entries).toHaveLength(2);
	});

	it("replays batch, update and remove without multiplying or resurrecting rows", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const created = await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-batch", {
				kind: "createBatch",
				date: "2026-09-05",
				meal: "lunch",
				entries: [
					{ ...snapshot({ clientEntryId: "batch-1" }), date: undefined, meal: undefined },
					{ ...snapshot({ clientEntryId: "batch-2" }), date: undefined, meal: undefined },
				].map(({ date: _date, meal: _meal, ...entry }) => entry),
			}),
		});
		const batchReplay = await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-batch", {
				kind: "createBatch",
				date: "2026-09-05",
				meal: "lunch",
				entries: [
					{ ...snapshot({ clientEntryId: "batch-1" }), date: undefined, meal: undefined },
					{ ...snapshot({ clientEntryId: "batch-2" }), date: undefined, meal: undefined },
				].map(({ date: _date, meal: _meal, ...entry }) => entry),
			}),
		});
		expect(batchReplay).toEqual(created);

		await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-update", {
				kind: "update",
				target: { kind: "clientEntryId", id: "batch-1" },
				quantity: 2,
			}),
		});
		await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-update", {
				kind: "update",
				target: { kind: "clientEntryId", id: "batch-1" },
				quantity: 2,
			}),
		});
		const afterUpdate = await alice.query(api.nutritionDiary.day, { date: "2026-09-05" });
		expect(afterUpdate.entries.find((entry) => entry.clientEntryId === "batch-1")?.quantity).toBe(2);

		await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-remove", {
				kind: "remove",
				target: { kind: "clientEntryId", id: "batch-1" },
			}),
		});
		await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-remove", {
				kind: "remove",
				target: { kind: "clientEntryId", id: "batch-1" },
			}),
		});
		expect((await alice.query(api.nutritionDiary.day, { date: "2026-09-05" })).entries).toHaveLength(1);
		await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-batch", {
				kind: "createBatch",
				date: "2026-09-05",
				meal: "lunch",
				entries: [
					{ ...snapshot({ clientEntryId: "batch-1" }), date: undefined, meal: undefined },
					{ ...snapshot({ clientEntryId: "batch-2" }), date: undefined, meal: undefined },
				].map(({ date: _date, meal: _meal, ...entry }) => entry),
			}),
		});
		expect((await alice.query(api.nutritionDiary.day, { date: "2026-09-05" })).entries).toHaveLength(1);
	});

	it("rejects a bad batch atomically and isolates subjects", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await expect(
			alice.mutation(api.nutritionDiary.applyOperation, {
				...envelope("op-invalid-batch", {
					kind: "createBatch",
					date: "2026-09-05",
					meal: "lunch",
					entries: [
						{ ...snapshot({ clientEntryId: "good" }), date: undefined, meal: undefined },
						{ ...snapshot({ clientEntryId: "bad", amount: 0 }), date: undefined, meal: undefined },
					].map(({ date: _date, meal: _meal, ...entry }) => entry),
				}),
			}),
		).rejects.toThrow("Amount");
		const empty = await alice.query(api.nutritionDiary.day, { date: "2026-09-05" });
		expect(empty.entries).toHaveLength(0);
		expect(empty.revision).toBe(0);

		const created = await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-owned", { kind: "create", entry: snapshot({ clientEntryId: "owned" }) }),
		});
		const bob = t.withIdentity({ subject: "bob" });
		await expect(
			bob.mutation(api.nutritionDiary.applyOperation, {
				...envelope("op-bob", {
					kind: "remove",
					target: { kind: "serverId", id: created.entryIds[0] },
				}, "bob"),
			}),
		).rejects.toThrow("Unauthorized");
		await expect(
			alice.mutation(api.nutritionDiary.applyOperation, {
				...envelope("op-subject", { kind: "remove", target: { kind: "serverId", id: created.entryIds[0] } }, "bob"),
			}),
		).rejects.toThrow("Subject mismatch");
		expect((await alice.query(api.nutritionDiary.day, { date: "2026-09-05" })).entries).toHaveLength(1);
	});

	it("increments both revisions when an entry moves and includes an empty day after removal", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const created = await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-move-create", { kind: "create", entry: snapshot({ clientEntryId: "move-me" }) }),
		});
		const moved = (await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-move", {
				kind: "update",
				target: { kind: "serverId", id: created.entryIds[0] },
				date: "2026-09-06",
			}),
		})) as { days: Array<{ date: string; revision: number }> };
		expect(moved.days.map((day) => [day.date, day.revision])).toEqual([
			["2026-09-05", 2],
			["2026-09-06", 1],
		]);
		await alice.mutation(api.nutritionDiary.applyOperation, {
			...envelope("op-remove-moved", { kind: "remove", target: { kind: "clientEntryId", id: "move-me" } }),
		});
		const empty = await alice.query(api.nutritionDiary.day, { date: "2026-09-06" });
		expect(empty.entries).toHaveLength(0);
		expect(empty.revision).toBe(2);
	});
});
