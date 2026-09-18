import {
	allShippedFoods,
	NUTRIENT_KEYS,
	personalFoodSnapshot,
} from "@workouts/core/nutrition";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import { resolveComboPart, scaleComboSnapshot } from "./nutrition-combo";
import { createPersonalFoodRepository } from "./personal-food-repository";

const nutrients = {
	energy: { kind: "value" as const, amount: 200 },
	protein: { kind: "trace" as const },
	carbs: { kind: "absent" as const },
	fat: { kind: "value" as const, amount: 3 },
	saturatedFat: { kind: "absent" as const },
	fibre: { kind: "trace" as const },
	sugars: { kind: "value" as const, amount: 2 },
	salt: { kind: "value" as const, amount: 0.2 },
};

describe("Combo snapshots", () => {
	it("ships only Diary nutrients when resolving shipped Foods", () => {
		const food = allShippedFoods()[0];
		const resolved = resolveComboPart(
			{
				id: "part",
				status: "available",
				reference: { kind: "shipped", foodId: food.id },
				snapshot: {
					name: food.name,
					serving: { en: "100 g", nl: "100 g" },
					amount: 100,
					quantity: 1,
					baseUnit: "g",
					nutrients,
					provenance: { source: "oneOff" },
				},
			},
			() => undefined,
		);
		expect(Object.keys(resolved.nutrients).sort()).toEqual(
			[...NUTRIENT_KEYS].sort(),
		);
		expect(resolved.nutrients).not.toHaveProperty("sodium");
	});
	it("uses current Personal Food estimates for new logs and freezes existing entries", () => {
		const database = new SQLiteTestDatabase();
		const foods = createPersonalFoodRepository(database);
		const food = foods.create({
			name: { en: "Soup", nl: "Soep" },
			baseUnit: "serving",
			classification: "recipe",
			estimated: true,
			nutritionBasis: { kind: "perServing", label: { en: "Bowl", nl: "Kom" } },
			nutrients,
			servings: [],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		const original = personalFoodSnapshot(food, { quantity: 1.5 });
		const combo = foods.createCombo({
			name: "Lunch",
			parts: [
				{
					reference: { kind: "personal", foodId: food.id },
					snapshot: original,
				},
			],
		});
		const first = scaleComboSnapshot(
			resolveComboPart(combo.parts[0], foods.find),
			2,
		);
		expect(first.serving).toEqual({ en: "Bowl × 3", nl: "Kom × 3" });
		expect(first).toMatchObject({
			estimated: true,
			baseUnit: "serving",
			amount: 3,
			nutrients: {
				energy: { amount: 600 },
				protein: { kind: "trace" },
				carbs: { kind: "absent" },
			},
		});
		foods.update(food.id, {
			...food,
			estimated: false,
			nutrients: { ...nutrients, energy: { kind: "value", amount: 250 } },
		});
		const next = resolveComboPart(combo.parts[0], foods.find);
		expect(next.estimated).toBeUndefined();
		expect(next.nutrients.energy).toEqual({ kind: "value", amount: 375 });
		expect(first.estimated).toBe(true);
		expect(original.nutrients.energy).toEqual({ kind: "value", amount: 300 });
		expect(foods.findCombo(combo.id)?.parts[0].snapshot).toEqual(original);
		foods.update(food.id, {
			...food,
			baseUnit: "g",
			nutritionBasis: { kind: "per100", unit: "g" },
		});
		expect(() => resolveComboPart(combo.parts[0], foods.find)).toThrow(
			"basis changed",
		);
		database.closeSync();
	});
	it("preserves a one-off estimate when scaling and rejects invalid multipliers", () => {
		const snapshot = {
			quantity: 1,
			amount: 100,
			nutrients,
			estimated: true as const,
			baseUnit: "g" as const,
			serving: { en: "100 g", nl: "100 g" },
		};
		expect(scaleComboSnapshot(snapshot, 1.5)).toMatchObject({
			estimated: true,
			amount: 150,
			nutrients: { energy: { amount: 300 }, carbs: { kind: "absent" } },
			serving: { en: "150 g" },
		});
		expect(snapshot.amount).toBe(100);
		expect(() => scaleComboSnapshot(snapshot, 0)).toThrow("greater than zero");
	});
});
