import { describe, expect, it } from "vitest";
import {
	type RecipeIngredientSnapshot,
	type RecipeVersion,
	recipeBatchSnapshots,
	recipeNutritionTotals,
	recipePortion,
	recipeScale,
	scaleCookingSnapshot,
	validateRecipeVersionDraft,
} from "./cooking";

const nutrient = {
	energy: { kind: "value" as const, amount: 333.333333333 },
	protein: { kind: "trace" as const },
	carbs: { kind: "absent" as const },
	fat: { kind: "value" as const, amount: 10 },
	saturatedFat: { kind: "absent" as const },
	fibre: { kind: "value" as const, amount: 2 },
	sugars: { kind: "trace" as const },
	salt: { kind: "value" as const, amount: 0.123456789 },
};

function ingredient(
	id: string,
	amount: number,
	nutrients = nutrient,
): RecipeIngredientSnapshot {
	return {
		ingredientId: id,
		sourceKey: `shipped:${id}`,
		name: { en: id, nl: id },
		serving: { en: `${amount} g`, nl: `${amount} g` },
		quantity: amount / 100,
		amount,
		baseUnit: "g",
		nutrients,
		provenance: { source: "oneOff" },
	};
}

function recipe(yieldValue: RecipeVersion["yield"]): RecipeVersion {
	return {
		id: "version-1",
		recipeId: "recipe-1",
		name: { en: "Soup", nl: "Soep" },
		versionName: { en: "Winter", nl: "Winter" },
		ingredients: [ingredient("oats", 100), ingredient("milk", 200)],
		yield: yieldValue,
		createdAt: 1,
		updatedAt: 1,
	};
}

describe("nutrition cooking", () => {
	it("keeps all eight ingredient states while summing unrounded values", () => {
		const totals = recipeNutritionTotals(
			recipe({ kind: "grams", amount: 300 }).ingredients,
		);
		expect(Object.keys(totals).sort()).toEqual([
			"carbs",
			"energy",
			"fat",
			"fibre",
			"protein",
			"salt",
			"saturatedFat",
			"sugars",
		]);
		expect(totals.energy.amount).toBe(666.666666666);
		expect(totals.energy.valueCount).toBe(2);
		expect(totals.carbs.incomplete).toBe(true);
		expect(totals.protein.traceCount).toBe(2);
	});

	it("scales grams from the exact cooked yield without rounding", () => {
		const preview = recipePortion(recipe({ kind: "grams", amount: 300 }), {
			kind: "grams",
			amount: 80,
		});
		expect(preview.scale).toBe(80 / 300);
		expect(preview.nutrients.energy.amount).toBe(666.666666666 * (80 / 300));
		expect(preview.nutrients.energy.incomplete).toBe(false);
		expect(preview.nutrients.carbs.incomplete).toBe(true);
	});

	it("scales number-of-portions requests and rejects mixed units", () => {
		expect(
			recipeScale(
				{ kind: "portions", amount: 6 },
				{ kind: "portions", amount: 2 },
			),
		).toBe(1 / 3);
		expect(() =>
			recipeScale(
				{ kind: "grams", amount: 500 },
				{ kind: "portions", amount: 1 },
			),
		).toThrow("match");
		expect(() =>
			recipeScale({ kind: "grams", amount: 0 }, { kind: "grams", amount: 1 }),
		).toThrow();
	});

	it("does not turn trace or absent values into numeric values when scaling snapshots", () => {
		const scaled = scaleCookingSnapshot(ingredient("beans", 50), 2);
		expect(scaled.amount).toBe(100);
		expect(scaled.nutrients.energy).toEqual({
			kind: "value",
			amount: 666.666666666,
		});
		expect(scaled.nutrients.protein).toEqual({ kind: "trace" });
		expect(scaled.nutrients.carbs).toEqual({ kind: "absent" });
		expect(() => scaleCookingSnapshot(ingredient("beans", 50), 0)).toThrow();
	});

	it("builds one atomic recipe batch with separate nutrient states and version identity", () => {
		const entries = recipeBatchSnapshots(
			{
				...recipe({ kind: "grams", amount: 300 }),
				recipeId: "recipe-1",
			},
			{ kind: "grams", amount: 75 },
			"2026-09-12",
			"dinner",
			"group-1",
			(() => {
				let index = 0;
				return () => `client-${++index}`;
			})(),
		);
		expect(entries).toHaveLength(2);
		expect(entries.map((entry) => entry.clientEntryId)).toEqual([
			"client-1",
			"client-2",
		]);
		expect(entries[0]?.amount).toBe(25);
		expect(entries[0]?.nutrients.carbs).toEqual({ kind: "absent" });
		expect(entries[0]?.comboGroup).toEqual({
			id: "group-1",
			comboId: "version-1",
			name: "Soup · Winter",
		});
		expect(entries[0]?.serving).toEqual({ en: "25 g", nl: "25 g" });
	});

	it("requires a named version, a yield and complete ingredient snapshots", () => {
		const valid = {
			name: { en: "Soup", nl: "Soep" },
			versionName: { en: "v1", nl: "v1" },
			ingredients: [ingredient("soup", 100)],
			yield: { kind: "portions" as const, amount: 4 },
		};
		expect(validateRecipeVersionDraft(valid)).toEqual(valid);
		expect(() =>
			validateRecipeVersionDraft({
				...valid,
				versionName: { en: "", nl: "v1" },
			}),
		).toThrow("version");
		expect(() =>
			validateRecipeVersionDraft({
				...valid,
				ingredients: [
					{
						...valid.ingredients[0],
						nutrients: { ...nutrient, salt: undefined },
					},
				],
			}),
		).toThrow("salt");
	});
});
