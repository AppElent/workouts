import { describe, expect, it } from "vitest";
import { correctDiaryNutrients } from "./diary-correction";
import { rankNutrientSources } from "./nutrient-sources";
import {
	ABSENT,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "./nutrients";

const nutrients = Object.fromEntries(
	NUTRIENT_KEYS.map((n) => [n, ABSENT]),
) as Record<NutrientKey, NutrientValue>;
describe("explicit diary corrections", () => {
	it("patches only chosen fields using the current historical amount", () => {
		const entry = {
			amount: 187.5,
			baseUnit: "ml" as const,
			nutrients: {
				...nutrients,
				energy: { kind: "value" as const, amount: 93.75 },
			},
		};
		const corrected = correctDiaryNutrients(entry, {
			baseUnit: "ml",
			basisAmount: 100,
			nutrients: { fibre: { kind: "value", amount: 2 } },
		});
		expect(corrected.nutrients.fibre).toEqual({ kind: "value", amount: 3.75 });
		expect(corrected.nutrients.energy).toEqual(entry.nutrients.energy);
		expect(corrected.nutrients.protein).toEqual(ABSENT);
		expect(corrected.correctedNutrients).toEqual(["fibre"]);
	});
	it("retains zero, trace and unknown as distinct states", () => {
		expect(
			correctDiaryNutrients(
				{ amount: 2, baseUnit: "serving", nutrients },
				{
					basisAmount: 1,
					baseUnit: "serving",
					nutrients: {
						fat: { kind: "value", amount: 0 },
						fibre: { kind: "trace" },
						salt: ABSENT,
					},
				},
			).nutrients,
		).toMatchObject({
			fat: { kind: "value", amount: 0 },
			fibre: { kind: "trace" },
			salt: ABSENT,
		});
	});
	it("rejects incompatible units and invalid figures", () => {
		const entry = { amount: 50, baseUnit: "g" as const, nutrients };
		expect(() =>
			correctDiaryNutrients(entry, {
				basisAmount: 100,
				baseUnit: "ml",
				nutrients: { fibre: { kind: "trace" } },
			}),
		).toThrow();
		for (const amount of [-1, Infinity, NaN])
			expect(() =>
				correctDiaryNutrients(entry, {
					basisAmount: 100,
					baseUnit: "g",
					nutrients: { fibre: { kind: "value", amount } },
				}),
			).toThrow();
	});
	it("ranks component entries without treating missing values as zero", () => {
		const entries = [
			{ id: "missing", nutrients },
			{
				id: "known",
				nutrients: { ...nutrients, fat: { kind: "value" as const, amount: 6 } },
			},
			{
				id: "trace",
				nutrients: { ...nutrients, fat: { kind: "trace" as const } },
			},
		];
		const result = rankNutrientSources(entries, "fat");
		expect(result.missing.map((e) => e.id)).toEqual(["missing"]);
		expect(result.ranked.map((r) => [r.entry.id, r.amount, r.share])).toEqual([
			["known", 6, 1],
			["trace", 0, 0],
		]);
	});
});
