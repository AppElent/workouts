import {
	oneOffLogSnapshot,
	recipeLogBatch,
	recipePreview,
	scaleComboSnapshot,
} from "./nutrition-cooking-helpers";
import type { CookingRecipe } from "./nutrition-cooking-repository";

const nutrients = {
	energy: { kind: "value" as const, amount: 200 },
	protein: { kind: "trace" as const },
	carbs: { kind: "absent" as const },
	fat: { kind: "value" as const, amount: 3 },
	saturatedFat: { kind: "absent" as const },
	fibre: { kind: "value" as const, amount: 1 },
	sugars: { kind: "trace" as const },
	salt: { kind: "value" as const, amount: 0.2 },
};

const recipe: CookingRecipe = {
	id: "recipe-1",
	subject: "account-a",
	name: { en: "Soup", nl: "Soep" },
	versionName: { en: "Winter", nl: "Winter" },
	ingredients: [
		{
			ingredientId: "ingredient-1",
			sourceKey: "shipped:soup",
			name: { en: "Soup base", nl: "Soepbasis" },
			serving: { en: "100 g", nl: "100 g" },
			quantity: 1,
			amount: 100,
			baseUnit: "g",
			nutrients,
			provenance: { source: "oneOff" },
		},
	],
	yield: { kind: "grams", amount: 400 },
	createdAt: 1,
	updatedAt: 1,
};

describe("nutrition cooking helpers", () => {
	it("uses core recipe arithmetic and preserves ingredient states in the batch", () => {
		const preview = recipePreview(recipe, { kind: "grams", amount: 100 });
		expect(preview.scale).toBe(0.25);
		expect(preview.nutrients.energy.amount).toBe(50);
		expect(preview.nutrients.carbs.incomplete).toBe(true);

		const entries = recipeLogBatch(
			recipe,
			{ kind: "grams", amount: 100 },
			"2026-09-12",
			"lunch",
			"recipe-group",
			(() => {
				let count = 0;
				return () => `client-${++count}`;
			})(),
		);
		expect(entries[0]).toMatchObject({
			amount: 25,
			clientEntryId: "client-1",
			comboGroup: {
				id: "recipe-group",
				comboId: "recipe-1",
				name: "Soup · Winter",
			},
			nutrients: { carbs: { kind: "absent" }, protein: { kind: "trace" } },
			serving: { en: "25 g", nl: "25 g" },
		});
	});

	it("scales a Combo only for the new log and rejects non-positive factors", () => {
		const scaled = scaleComboSnapshot(
			{
				quantity: 1,
				amount: 100,
				baseUnit: "g" as const,
				serving: { en: "100 g", nl: "100 g" },
				nutrients,
			},
			1.5,
		);
		expect(scaled.amount).toBe(150);
		expect(scaled.serving).toEqual({ en: "150 g", nl: "150 g" });
		expect(scaled.nutrients.carbs).toEqual({ kind: "absent" });
		expect(scaled.nutrients.energy).toEqual({ kind: "value", amount: 300 });
		expect(() =>
			scaleComboSnapshot({ quantity: 1, amount: 100, nutrients }, 0),
		).toThrow("greater than zero");
	});

	it("makes blank Log once nutrients absent and supports millilitres", () => {
		const snapshot = oneOffLogSnapshot({
			date: "2026-09-12",
			meal: "breakfast",
			name: { en: "Coffee", nl: "Koffie" },
			amount: 250,
			baseUnit: "ml",
			nutrients: { energy: { kind: "value", amount: 4 } },
			clientEntryId: "client-1",
		});
		expect(snapshot.serving).toEqual({
			en: "Estimated · 250 ml",
			nl: "Geschat · 250 ml",
		});
		expect(snapshot.baseUnit).toBe("ml");
		expect(snapshot.nutrients.fibre).toEqual({ kind: "absent" });
	});
});
