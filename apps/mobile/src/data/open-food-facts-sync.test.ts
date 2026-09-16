import type { NutrientKey, NutrientValue } from "@workouts/core/nutrition";
import {
	OFF_REFRESH_INTERVAL_MS,
	refreshOpenFoodFactsImports,
} from "./open-food-facts-sync";
import type {
	PersonalFood,
	PersonalFoodDraft,
} from "./personal-food-repository";

const nutrients = {
	energy: { kind: "value", amount: 100 },
	protein: { kind: "absent" },
	carbs: { kind: "absent" },
	fat: { kind: "absent" },
	saturatedFat: { kind: "absent" },
	fibre: { kind: "absent" },
	sugars: { kind: "absent" },
	salt: { kind: "absent" },
} satisfies Record<NutrientKey, NutrientValue>;

function importedFood(id: string, locallyEdited = false): PersonalFood {
	return {
		id,
		name: { en: `Local ${id}`, nl: `Lokaal ${id}` },
		baseUnit: "g",
		nutrients,
		servings: [{ label: { en: "My portion", nl: "Mijn portie" }, amount: 30 }],
		provenance: {
			recordOrigin: "import",
			nutritionSource: "openfoodfacts",
			locallyEdited,
			provider: "Open Food Facts",
			barcode: id,
			brand: "Old brand",
		},
		createdAt: 1,
		updatedAt: 1,
	};
}

function latestDraft(id: string): PersonalFoodDraft {
	return {
		name: { en: `Remote ${id}`, nl: `Extern ${id}` },
		baseUnit: "g",
		nutrients: { ...nutrients, energy: { kind: "value", amount: 120 } },
		servings: [{ label: { en: "Can", nl: "Can" }, amount: 200 }],
		provenance: {
			recordOrigin: "import",
			nutritionSource: "openfoodfacts",
			locallyEdited: false,
			provider: "Open Food Facts",
			barcode: id,
			brand: "New brand",
			quantity: "400 g",
		},
	};
}

describe("refreshOpenFoodFactsImports", () => {
	it("fully refreshes untouched imports and paces provider requests", async () => {
		const foods = [importedFood("111"), importedFood("222")];
		const update = jest.fn((_id: string, draft: PersonalFoodDraft) => ({
			...foods[0],
			...draft,
		}));
		const wait = jest.fn(async () => {});
		const result = await refreshOpenFoodFactsImports({
			foods,
			refreshBarcode: async (barcode) => ({
				kind: "found",
				draft: latestDraft(barcode),
				fromCache: false,
			}),
			update,
			wait,
		});
		expect(update.mock.calls[0][1].name.en).toBe("Remote 111");
		expect(wait).toHaveBeenCalledWith(OFF_REFRESH_INTERVAL_MS);
		expect(result).toMatchObject({ updated: 2, failed: 0, completed: 2 });
	});

	it("refreshes only provider metadata on locally edited imports", async () => {
		const food = importedFood("111", true);
		const update = jest.fn((_id: string, draft: PersonalFoodDraft) => ({
			...food,
			...draft,
		}));
		await refreshOpenFoodFactsImports({
			foods: [food],
			refreshBarcode: async () => ({
				kind: "found",
				draft: latestDraft("111"),
				fromCache: false,
			}),
			update,
		});
		const draft = update.mock.calls[0][1];
		expect(draft.name).toEqual(food.name);
		expect(draft.nutrients).toEqual(food.nutrients);
		expect(draft.servings).toEqual(food.servings);
		expect(draft.provenance).toMatchObject({
			locallyEdited: true,
			brand: "New brand",
			quantity: "400 g",
		});
	});

	it("keeps failed provider records unchanged and reports them", async () => {
		const update = jest.fn();
		const result = await refreshOpenFoodFactsImports({
			foods: [importedFood("111")],
			refreshBarcode: async () => ({ kind: "not-found" }),
			update,
		});
		expect(update).not.toHaveBeenCalled();
		expect(result).toMatchObject({ failed: 1, completed: 1 });
	});

	it("stops issuing requests after a provider rate limit", async () => {
		const refreshBarcode = jest.fn(async () => ({
			kind: "rate-limited" as const,
		}));
		const result = await refreshOpenFoodFactsImports({
			foods: [importedFood("111"), importedFood("222")],
			refreshBarcode,
			update: jest.fn(),
			wait: async () => {},
		});
		expect(refreshBarcode).toHaveBeenCalledTimes(1);
		expect(result).toMatchObject({ failed: 2, completed: 2 });
	});
});
