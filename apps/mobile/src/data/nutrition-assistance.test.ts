import { totalNutrients } from "@foundry/core/nutrition";
import {
	type AssistanceFood,
	buildAssistanceFoodCatalog,
	searchAssistanceFoods,
} from "./nutrition-assistance";

const food = (
	id: string,
	name: string,
	baseUnit: "g" | "ml" = "g",
): AssistanceFood => ({
	id,
	kind: "personal",
	name: { en: name, nl: name },
	baseUnit,
	nutrients: {
		energy: { kind: "value", amount: 100 },
		protein: { kind: "value", amount: 10 },
		carbs: { kind: "value", amount: 20 },
		fat: { kind: "absent" },
		saturatedFat: { kind: "absent" },
		fibre: { kind: "absent" },
		sugars: { kind: "absent" },
		salt: { kind: "absent" },
	},
	provenance: {
		source: "personal",
		sourceId: id,
		nutritionSource: "manual",
		locallyEdited: true,
	},
});

describe("assistance food catalog", () => {
	it("builds a local catalog from personal and shipped sources without changing snapshots", () => {
		const personal = {
			id: "p",
			name: { en: "Food", nl: "Voedsel" },
			baseUnit: "g" as const,
			classification: "ordinary" as const,
			nutritionBasis: { kind: "per100" as const, unit: "g" as const },
			estimated: false,
			nutrients: food("p", "Food").nutrients,
			provenance: {
				recordOrigin: "personal" as const,
				nutritionSource: "manual" as const,
				locallyEdited: true,
			},
			servings: [],
			createdAt: 1,
			updatedAt: 1,
		};
		const catalog = buildAssistanceFoodCatalog([], [personal]);
		expect(catalog).toHaveLength(1);
		expect(totalNutrients([catalog[0]?.nutrients ?? {}]).energy.amount).toBe(
			100,
		);
	});

	it("only offers foods that are in the catalog", () => {
		const personal = food("own", "Havermout ontbijt");
		expect(searchAssistanceFoods("havermout", [personal], "nl", 20)).toEqual([
			personal,
		]);
	});
});
