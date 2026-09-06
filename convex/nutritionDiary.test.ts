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
});
