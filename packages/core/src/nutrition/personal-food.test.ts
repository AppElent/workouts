import { describe, expect, it } from "vitest";
import {
	normalizePersonalFood,
	type PersonalFoodDraft,
	personalFoodServingOptions,
	personalFoodSnapshot,
	personalFoodSnapshotAtAmount,
	validatePersonalFoodDraft,
} from "./personal-food";

const legacy: PersonalFoodDraft = {
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
};

function food(draft: PersonalFoodDraft = legacy) {
	return normalizePersonalFood({
		...draft,
		id: "soup",
		createdAt: 1,
		updatedAt: 2,
	});
}

describe("Personal Food normalization and diary selections", () => {
	it("normalizes legacy foods without treating manual figures as estimates", () => {
		expect(food()).toMatchObject({
			classification: "ordinary",
			nutritionBasis: { kind: "per100", unit: "ml" },
			estimated: false,
		});
		expect(personalFoodSnapshot(food(), { quantity: 1 })).not.toHaveProperty(
			"estimated",
		);
		expect(food({ ...legacy, classification: "recipe" }).estimated).toBe(false);
		expect(food({ ...legacy, estimated: true }).classification).toBe(
			"ordinary",
		);
	});

	it("scales selected per-100 servings without replacing trace, absent, or measured zero", () => {
		const selected = personalFoodSnapshot(food(), {
			date: "2026-09-16",
			meal: "dinner",
			quantity: 2,
			serving: personalFoodServingOptions(food())[0],
		});
		expect(selected).toMatchObject({
			date: "2026-09-16",
			meal: "dinner",
			amount: 500,
			quantity: 2,
			baseUnit: "ml",
			serving: { en: "Bowl × 2", nl: "Kom × 2" },
			nutrients: {
				energy: { kind: "value", amount: 400 },
				protein: { kind: "trace" },
				carbs: { kind: "absent" },
				fat: { kind: "value", amount: 0 },
			},
			provenance: {
				source: "personal",
				sourceId: "soup",
				nutritionSource: "manual",
			},
		});
	});

	it("logs named per-serving estimates without inventing a gram weight", () => {
		const estimated = food({
			...legacy,
			baseUnit: "serving",
			servings: [],
			classification: "recipe",
			estimated: true,
			nutritionBasis: { kind: "perServing", label: { en: "Bowl", nl: "Kom" } },
			description: { en: "Family soup", nl: "Familiesoep" },
		});
		expect(personalFoodServingOptions(estimated)).toEqual([
			{
				kind: "base-unit",
				amount: 1,
				unit: "serving",
				label: { en: "Bowl", nl: "Kom" },
			},
		]);
		const selected = personalFoodSnapshot(estimated, { quantity: 1.5 });
		expect(selected).toMatchObject({
			estimated: true,
			amount: 1.5,
			baseUnit: "serving",
			serving: { en: "Bowl × 1.5", nl: "Kom × 1,5" },
			nutrients: {
				energy: { kind: "value", amount: 120 },
				protein: { kind: "trace" },
				carbs: { kind: "absent" },
			},
		});
		const edited = food({
			...estimated,
			estimated: false,
			nutrients: {
				...estimated.nutrients,
				energy: { kind: "value", amount: 200 },
			},
		});
		expect(
			personalFoodSnapshot(edited, { quantity: 1 }).estimated,
		).toBeUndefined();
		expect(selected.estimated).toBe(true);
		expect(selected.nutrients.energy).toEqual({ kind: "value", amount: 120 });
	});

	it("resolves Combo amounts with current estimates and rejects a changed basis unit", () => {
		const current = food({ ...legacy, estimated: true });
		const selected = personalFoodSnapshotAtAmount(current, {
			amount: 200,
			quantity: 2,
			baseUnit: "ml",
			serving: { en: "Cup × 2", nl: "Kop × 2" },
		});
		expect(selected).toMatchObject({
			amount: 200,
			quantity: 2,
			estimated: true,
			serving: { en: "Cup × 2" },
			nutrients: { energy: { kind: "value", amount: 160 } },
		});
		expect(() =>
			personalFoodSnapshotAtAmount(current, {
				amount: 200,
				quantity: 2,
				baseUnit: "g",
			}),
		).toThrow("nutrition basis changed");
	});

	it("rejects invalid basis, metadata, and figures at the library boundary", () => {
		expect(() =>
			validatePersonalFoodDraft({ ...legacy, baseUnit: "serving" }),
		).toThrow("named nutrition basis");
		expect(() =>
			validatePersonalFoodDraft({
				...legacy,
				nutritionBasis: {
					kind: "perServing",
					label: { en: "Bowl", nl: "Kom" },
				},
			}),
		).toThrow("base unit");
		expect(() =>
			validatePersonalFoodDraft({
				...legacy,
				nutritionBasis: { kind: "per100", unit: "g" },
			}),
		).toThrow("base unit");
		expect(() =>
			validatePersonalFoodDraft({
				...legacy,
				nutrients: {
					...legacy.nutrients,
					energy: { kind: "value", amount: -1 },
				},
			}),
		).toThrow("zero or greater");
		expect(() => personalFoodSnapshot(food(), { quantity: Infinity })).toThrow(
			"Quantity",
		);
	});
});
