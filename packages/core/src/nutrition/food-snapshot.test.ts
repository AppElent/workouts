import { describe, expect, it } from "vitest";
import {
	foodSnapshot,
	foodSnapshotAtAmount,
	shippedFoodProvenance,
} from "./food-snapshot";
import { getShippedFood, shippedSourceMeta } from "./library";
import { NUTRIENT_KEYS } from "./nutrients";
import { normalizePersonalFood } from "./personal-food";
import { servingOptions } from "./servings";
import {
	relabelServing,
	rescaleToQuantity,
	rescaleToSelection,
} from "./snapshot-rescale";

const apple = (() => {
	const found = getShippedFood("shipped:apple-w-skin-av");
	if (!found) throw new Error("fixture missing");
	return found;
})();

const soup = normalizePersonalFood({
	id: "soup",
	createdAt: 1,
	updatedAt: 2,
	name: { en: "Soup", nl: "Soep" },
	baseUnit: "ml",
	nutrients: {
		energy: { kind: "value", amount: 80 },
		protein: { kind: "trace" },
		carbs: { kind: "absent" },
		fat: { kind: "value", amount: 0 },
		saturatedFat: { kind: "absent" },
		fibre: { kind: "trace" },
		sugars: { kind: "value", amount: 2 },
		salt: { kind: "value", amount: 0.3 },
	},
	servings: [{ label: { en: "Bowl", nl: "Kom" }, amount: 250 }],
	provenance: {
		recordOrigin: "personal",
		nutritionSource: "manual",
		locallyEdited: false,
	},
});

describe("Food Snapshot", () => {
	it("records Shipped Food provenance from the food's source table", () => {
		const source = shippedSourceMeta(apple);
		expect(shippedFoodProvenance(apple)).toEqual({
			source: "shipped",
			sourceId: apple.id,
			dataset: source.name,
			edition: source.edition,
			sourceCode: apple.code,
			sourceName: apple.sourceName,
			saltDerived: source.saltDerived,
		});
	});

	it("snapshots a Shipped Food at a Serving with only diary nutrient keys", () => {
		const grams = servingOptions(apple).at(-1);
		if (!grams) throw new Error("no base unit option");
		const snapshot = foodSnapshot({ kind: "shipped", food: apple }, grams, 150);
		expect(snapshot).toMatchObject({
			name: apple.name,
			serving: { en: "Gram (g) × 150", nl: "Gram (g) × 150" },
			quantity: 150,
			amount: 150,
			baseUnit: "g",
			provenance: { source: "shipped", sourceId: apple.id },
		});
		expect(Object.keys(snapshot.nutrients).sort()).toEqual(
			[...NUTRIENT_KEYS].sort(),
		);
		expect(snapshot).not.toHaveProperty("personalMeasureId");
	});

	it("keeps a Personal Measure's identity on both kinds of Food", () => {
		const measure = {
			kind: "personal-measure" as const,
			id: "measure-1",
			label: { en: "Mug (300 ml)", nl: "Mok (300 ml)" },
			amount: 300,
			unit: "ml" as const,
		};
		const snapshot = foodSnapshot({ kind: "personal", food: soup }, measure, 1);
		expect(snapshot).toMatchObject({
			personalMeasureId: "measure-1",
			amount: 300,
			serving: { en: "Mug (300 ml) × 1", nl: "Mok (300 ml) × 1" },
			nutrients: { energy: { kind: "value", amount: 240 } },
			provenance: { source: "personal", sourceId: "soup" },
		});
	});

	it("resolves a saved selection with current figures and the saved label", () => {
		const saved = {
			amount: 200,
			quantity: 2,
			baseUnit: "g" as const,
			serving: { en: "Apple × 2", nl: "Appel × 2" },
		};
		const fresh = foodSnapshotAtAmount({ kind: "shipped", food: apple }, saved);
		expect(fresh).toMatchObject({ ...saved, name: apple.name });
		expect(fresh.nutrients.energy).toEqual(
			foodSnapshot(
				{ kind: "shipped", food: apple },
				{
					kind: "base-unit",
					label: { en: "g", nl: "g" },
					amount: 1,
					unit: "g",
				},
				200,
			).nutrients.energy,
		);
		expect(
			foodSnapshotAtAmount(
				{ kind: "personal", food: soup },
				{
					...saved,
					baseUnit: "ml",
					serving: { en: "Bowl × 2", nl: "Kom × 2" },
				},
			),
		).toMatchObject({
			serving: { en: "Bowl × 2", nl: "Kom × 2" },
			nutrients: { energy: { kind: "value", amount: 160 } },
		});
	});
});

describe("Snapshot rescaling", () => {
	const entry = {
		quantity: 1,
		amount: 200,
		baseUnit: "ml" as const,
		serving: { en: "Glass (200 ml) × 1", nl: "Glas (200 ml) × 1" },
		nutrients: {
			energy: { kind: "value" as const, amount: 100 },
			salt: { kind: "trace" as const },
		},
		name: "kept",
	};

	it("changes only the trailing multiplier of a Serving label", () => {
		expect(relabelServing(entry, 1.5, 300)).toEqual({
			en: "Glass (200 ml) × 1.5",
			nl: "Glas (200 ml) × 1,5",
		});
	});

	it("restates a total-amount label instead of appending a multiplier", () => {
		// A Combo part saved from a scaled One-off Entry: 200 g at quantity 2.
		const total = {
			...entry,
			quantity: 2,
			amount: 200,
			baseUnit: "g" as const,
			serving: { en: "200 g", nl: "200 g" },
		};
		expect(rescaleToQuantity(total, 2).serving).toEqual({
			en: "200 g",
			nl: "200 g",
		});
		expect(rescaleToQuantity(total, 3).serving).toEqual({
			en: "300 g",
			nl: "300 g",
		});
	});

	it("rescales to a quantity, keeping every other snapshot property", () => {
		expect(rescaleToQuantity(entry, 2)).toEqual({
			...entry,
			quantity: 2,
			amount: 400,
			serving: { en: "Glass (200 ml) × 2", nl: "Glas (200 ml) × 2" },
			nutrients: {
				energy: { kind: "value", amount: 200 },
				salt: { kind: "trace" },
			},
		});
		expect(() => rescaleToQuantity(entry, 0)).toThrow();
	});

	it("rescales to a new selection by amount and takes its label", () => {
		const serving = { en: "Gram (g) × 50", nl: "Gram (g) × 50" };
		expect(
			rescaleToSelection(entry, { serving, quantity: 50, amount: 50 }),
		).toMatchObject({
			quantity: 50,
			amount: 50,
			serving,
			nutrients: { energy: { kind: "value", amount: 25 } },
		});
	});
});
