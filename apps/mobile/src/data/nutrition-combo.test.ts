import {
	allShippedFoods,
	NUTRIENT_KEYS,
	personalFoodSnapshot,
} from "@foundry/core/nutrition";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import {
	comboLogEntries,
	comboLogPlan,
	resolveComboPart,
} from "./nutrition-combo";
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
		const [first] = comboLogEntries(comboLogPlan(combo, {}, foods.find), 2);
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
		const combo = {
			id: "combo",
			name: "Snack",
			createdAt: 1,
			updatedAt: 1,
			parts: [
				{
					id: "part",
					status: "available" as const,
					reference: { kind: "oneOff" as const },
					snapshot: {
						name: { en: "Nuts", nl: "Noten" },
						quantity: 1,
						amount: 100,
						nutrients,
						estimated: true as const,
						baseUnit: "g" as const,
						serving: { en: "100 g", nl: "100 g" },
						provenance: { source: "oneOff" as const },
					},
				},
			],
		};
		const plan = comboLogPlan(combo, {}, () => undefined);
		expect(comboLogEntries(plan, 1.5)[0]).toMatchObject({
			estimated: true,
			amount: 150,
			nutrients: { energy: { amount: 300 }, carbs: { kind: "absent" } },
			serving: { en: "150 g", nl: "150 g" },
		});
		expect(combo.parts[0].snapshot.amount).toBe(100);
		expect(() => comboLogEntries(plan, 0)).toThrow("greater than zero");
	});
	it("previews and logs the same current figures, including only-this-time amounts", () => {
		const database = new SQLiteTestDatabase();
		const foods = createPersonalFoodRepository(database);
		const yoghurt = foods.create({
			name: { en: "Yoghurt", nl: "Yoghurt" },
			baseUnit: "g",
			nutrients: { ...nutrients, energy: { kind: "value", amount: 100 } },
			servings: [{ label: { en: "Bowl", nl: "Kom" }, amount: 150 }],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		const saved = personalFoodSnapshot(yoghurt, {
			quantity: 1,
			serving: yoghurt.servings[0],
		});
		const combo = foods.createCombo({
			name: "Breakfast",
			parts: [
				{
					reference: { kind: "personal", foodId: yoghurt.id },
					snapshot: saved,
				},
			],
		});
		foods.update(yoghurt.id, {
			...yoghurt,
			nutrients: { ...nutrients, energy: { kind: "value", amount: 130 } },
		});
		const plan = comboLogPlan(combo, {}, foods.find);
		const [logged] = comboLogEntries(plan, 1);
		expect(plan.nutrients.energy).toEqual({ kind: "value", amount: 195 });
		expect(logged.nutrients.energy).toEqual(plan.nutrients.energy);

		const once = {
			...plan.parts[0].snapshot,
			quantity: 2,
			amount: 300,
			serving: { en: "Bowl × 2", nl: "Kom × 2" },
		};
		const oncePlan = comboLogPlan(
			combo,
			{ [combo.parts[0].id]: { included: true, once } },
			foods.find,
		);
		const [onceLogged] = comboLogEntries(oncePlan, 1);
		expect(oncePlan.nutrients.energy).toEqual({ kind: "value", amount: 390 });
		expect(onceLogged).toMatchObject({
			amount: 300,
			serving: { en: "Bowl × 2", nl: "Kom × 2" },
			nutrients: { energy: { kind: "value", amount: 390 } },
		});
		database.closeSync();
	});
	it("keeps Unavailable Food parts off and refuses to log unresolved sources", () => {
		const combo = {
			id: "combo",
			name: "Lunch",
			createdAt: 1,
			updatedAt: 1,
			parts: [
				{
					id: "gone",
					status: "missing" as const,
					reference: { kind: "personal" as const, foodId: "gone" },
					snapshot: {
						name: { en: "Gone", nl: "Weg" },
						quantity: 1,
						amount: 100,
						nutrients,
						baseUnit: "g" as const,
						serving: { en: "100 g", nl: "100 g" },
						provenance: {
							source: "personal" as const,
							sourceId: "gone",
							nutritionSource: "manual" as const,
							locallyEdited: false,
						},
					},
				},
			],
		};
		const plan = comboLogPlan(combo, {}, () => undefined);
		expect(plan.included).toEqual([]);
		expect(plan.missing.map((part) => part.id)).toEqual(["gone"]);
		const unloaded = comboLogPlan(
			{ ...combo, parts: [{ ...combo.parts[0], status: "unloaded" as const }] },
			{},
			() => undefined,
		);
		expect(unloaded.parts[0]).toMatchObject({
			included: true,
			resolved: false,
		});
		expect(() => comboLogEntries(unloaded, 1)).toThrow("missing");
	});
});
