import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type PersonalFood,
} from "@workouts/core/nutrition";
import type { Combo } from "../../../data/personal-food-repository";
import {
	combosUsing,
	filterLibrary,
	libraryItems,
	librarySections,
} from "./library-items";

function nutrients(energy: number) {
	const values = Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, { kind: "absent" }]),
	) as Record<NutrientKey, NutrientValue>;
	values.energy = { kind: "value", amount: energy };
	return values;
}

function food(
	id: string,
	name: string,
	options: {
		recipe?: boolean;
		brand?: string;
		barcode?: string;
	} = {},
): PersonalFood {
	return {
		id,
		name: { en: name, nl: name },
		baseUnit: "g",
		nutrients: nutrients(100),
		servings: [],
		classification: options.recipe ? "recipe" : "ordinary",
		nutritionBasis: { kind: "per100", unit: "g" },
		estimated: false,
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
			brand: options.brand,
			barcode: options.barcode,
		},
		createdAt: 1,
		updatedAt: 1,
	};
}

function combo(id: string, name: string, foodIds: string[]): Combo {
	return {
		id,
		name,
		createdAt: 1,
		updatedAt: 1,
		parts: foodIds.map((foodId, index) => ({
			id: `${id}-${index}`,
			status: "available",
			reference: { kind: "personal", foodId },
			snapshot: {
				name: { en: foodId, nl: foodId },
				serving: { en: "1", nl: "1" },
				quantity: 1,
				amount: 1,
				baseUnit: "serving",
				nutrients: nutrients(50),
				provenance: { source: "oneOff" },
			},
		})),
	};
}

const foods = [
	food("f1", "Kipfilet gekruid"),
	food("f2", "Kipfilet broodbeleg", { brand: "Plus", barcode: "8710" }),
	food("f3", "Havermout"),
	food("r1", "Kip-kerrie", { recipe: true }),
];
const combos = [combo("c1", "Salade kip", ["f1", "f3"])];

describe("library items", () => {
	const items = libraryItems(foods, combos, new Set(["personal:f3"]));

	it("groups foods, recipes and combos into sections in that order", () => {
		expect(
			librarySections(
				filterLibrary(items, { chip: "all", query: "", locale: "en" }),
			).map((section) => [section.kind, section.items.map((item) => item.id)]),
		).toEqual([
			["food", ["f3", "f2", "f1"]],
			["recipe", ["r1"]],
			["combo", ["c1"]],
		]);
	});

	it("searches names, brands and barcodes regardless of case and accents", () => {
		const ids = (query: string) =>
			filterLibrary(items, { chip: "all", query, locale: "nl" }).map(
				(item) => item.id,
			);
		expect(ids("KIP")).toEqual(["f2", "f1", "r1", "c1"]);
		expect(ids("plus")).toEqual(["f2"]);
		expect(ids("8710")).toEqual(["f2"]);
		expect(ids("kíp-kerrie")).toEqual(["r1"]);
	});

	it("filters by chip, including favourites", () => {
		expect(
			filterLibrary(items, { chip: "favorite", query: "", locale: "en" }).map(
				(item) => item.id,
			),
		).toEqual(["f3"]);
		expect(
			filterLibrary(items, { chip: "recipe", query: "", locale: "en" }).map(
				(item) => item.id,
			),
		).toEqual(["r1"]);
	});

	it("names the combos that use a food", () => {
		expect(combosUsing("f3", combos).map((item) => item.name)).toEqual([
			"Salade kip",
		]);
		expect(combosUsing("f2", combos)).toEqual([]);
	});
});
