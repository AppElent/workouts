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
});
