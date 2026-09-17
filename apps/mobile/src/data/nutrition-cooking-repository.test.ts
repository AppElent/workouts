import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NutrientKey, NutrientValue } from "@workouts/core/nutrition";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import {
	type CookingIngredientSnapshot,
	type CookingRecipeDraft,
	createNutritionCookingRepository,
} from "./nutrition-cooking-repository";

const nutrients: Record<NutrientKey, NutrientValue> = {
	energy: { kind: "value", amount: 100 },
	protein: { kind: "trace" },
	carbs: { kind: "absent" },
	fat: { kind: "value", amount: 2 },
	saturatedFat: { kind: "absent" },
	fibre: { kind: "value", amount: 1 },
	sugars: { kind: "trace" },
	salt: { kind: "value", amount: 0.2 },
};

function ingredient(id = "oats"): CookingIngredientSnapshot {
	return {
		ingredientId: id,
		sourceKey: `shipped:${id}`,
		name: { en: id, nl: id },
		serving: { en: "100 g", nl: "100 g" },
		quantity: 1,
		amount: 100,
		baseUnit: "g",
		nutrients,
		provenance: {
			source: "shipped",
			sourceId: `shipped:${id}`,
			dataset: "NEVO",
			edition: "2025/9.0",
			sourceCode: 1,
			sourceName: { en: id, nl: id },
			saltDerived: true,
		},
	};
}

function recipeDraft(): CookingRecipeDraft {
	return {
		name: { en: "Porridge", nl: "Havermoutpap" },
		versionName: { en: "Weekday", nl: "Doordeweeks" },
		ingredients: [ingredient()],
		yield: { kind: "grams", amount: 250 },
	};
}

describe("nutrition cooking SQLite repository", () => {
	it("keeps recipes isolated by account and durable across reopen", () => {
		const path = join(
			tmpdir(),
			`workouts-cooking-${Date.now()}-${Math.random()}.db`,
		);
		try {
			const first = new SQLiteTestDatabase(path);
			const repo = createNutritionCookingRepository(first, {
				mintId: (() => {
					let count = 0;
					return () => `id-${++count}`;
				})(),
				now: () => 10,
			});
			const recipe = repo.createRecipe("account-a", recipeDraft());
			expect(repo.listRecipes("account-b")).toEqual([]);
			repo.close();

			const reopenedDatabase = new SQLiteTestDatabase(path);
			const reopened = createNutritionCookingRepository(reopenedDatabase);
			expect(reopened.getRecipe("account-a", recipe.id)).toMatchObject({
				name: { en: "Porridge", nl: "Havermoutpap" },
				versionName: { en: "Weekday", nl: "Doordeweeks" },
				ingredients: [expect.objectContaining({ nutrients })],
			});
			reopened.close();
		} finally {
			try {
				unlinkSync(path);
			} catch {
				// The test database may already have been cleaned up by the adapter.
			}
		}
	});

	it("rejects incomplete recipes and does not write a partial row", () => {
		const database = new SQLiteTestDatabase();
		const repo = createNutritionCookingRepository(database);
		expect(() =>
			repo.createRecipe("account-a", {
				...recipeDraft(),
				ingredients: [
					{
						...ingredient(),
						nutrients: {
							...nutrients,
							salt: undefined as unknown as NutrientValue,
						},
					},
				],
			}),
		).toThrow("salt");
		expect(repo.listRecipes("account-a")).toEqual([]);
	});
});
