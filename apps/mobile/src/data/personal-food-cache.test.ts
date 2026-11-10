import type { NUTRIENT_KEYS, NutrientValue } from "@foundry/core";
import { forkShippedFood, getShippedFood } from "@foundry/core/shipped-foods";
import {
	type LibraryRecord,
	libraryRecordFromCombo,
	libraryRecordFromFood,
} from "./nutrition-library-repository";
import { createPersonalFoodCache } from "./personal-food-cache";
import {
	type Combo,
	type ComboDraft,
	normalizePersonalFoodDraft,
	type PersonalFood,
	type PersonalFoodDraft,
} from "./personal-food-repository";

function nutrients(): Record<(typeof NUTRIENT_KEYS)[number], NutrientValue> {
	return {
		energy: { kind: "value", amount: 0 },
		protein: { kind: "trace" },
		carbs: { kind: "absent" },
		fat: { kind: "value", amount: 12.5 },
		saturatedFat: { kind: "absent" },
		fibre: { kind: "trace" },
		sugars: { kind: "value", amount: 3 },
		salt: { kind: "value", amount: 0.2 },
	};
}

function food(
	id: string,
	overrides: Partial<PersonalFoodDraft> = {},
	updatedAt = 1_000,
): PersonalFood {
	return {
		...normalizePersonalFoodDraft({
			name: { en: "Training oats", nl: "Trainingshavermout" },
			baseUnit: "g",
			nutrients: nutrients(),
			servings: [{ label: { en: "Bowl", nl: "Kom" }, amount: 75 }],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
			...overrides,
		}),
		id,
		createdAt: 1_000,
		updatedAt,
	};
}

function combo(id: string, parts: ComboDraft["parts"]): LibraryRecord {
	return libraryRecordFromCombo(
		{ id, name: "Breakfast", parts, createdAt: 1, updatedAt: 1 } as Combo,
		1,
	);
}

const snapshot = {
	name: { en: "Training oats", nl: "Trainingshavermout" },
	serving: { en: "Bowl × 1", nl: "Kom × 1" },
	quantity: 1,
	amount: 75,
	baseUnit: "g" as const,
	nutrients: nutrients(),
	provenance: { source: "oneOff" as const },
};

describe("the account library this session", () => {
	it("keeps the newest revision of an item, whatever order they arrive in", () => {
		const cache = createPersonalFoodCache();
		cache.receive(
			libraryRecordFromFood(
				food("oats", { name: { en: "New", nl: "Nieuw" } }),
				3,
			),
		);
		cache.receive(libraryRecordFromFood(food("oats"), 2));

		expect(cache.find("oats")?.name.en).toBe("New");
		expect(cache.revisionOf("oats")).toBe(3);
		expect(cache.revisionOf("unknown")).toBe(0);
	});

	it("forgets a deleted item and remembers that it was deleted", () => {
		const cache = createPersonalFoodCache();
		cache.receive(libraryRecordFromFood(food("oats"), 1));
		cache.receive({
			id: "oats",
			kind: "food",
			payload: null,
			revision: 2,
			deleted: true,
		});

		expect(cache.find("oats")).toBeUndefined();
		expect(cache.search("oats", "en")).toEqual([]);
		expect(cache.isDeleted("oats")).toBe(true);
	});

	it("keeps a device photo the server does not hold yet", () => {
		const cache = createPersonalFoodCache();
		const photo = {
			kind: "photo" as const,
			uri: "file:///food-photos/oats.jpg",
		};
		cache.keepDeviceFoods([food("oats", { visual: photo })]);
		cache.receive(libraryRecordFromFood(food("oats", { visual: photo }), 1));

		expect(cache.find("oats")?.visual).toEqual(photo);
	});

	it("rejects an item the app cannot read", () => {
		const cache = createPersonalFoodCache();
		expect(() =>
			cache.receive(
				libraryRecordFromFood(
					food("oats", { visual: { kind: "icon", preset: "pizza" } as never }),
				),
			),
		).toThrow(expect.objectContaining({ field: "visual", code: "invalid" }));
		expect(() => cache.receive(combo("empty", []))).toThrow("at least one");
	});

	it("filters recipes and searches both languages, sorted by the shown name", () => {
		const cache = createPersonalFoodCache();
		const recipe = food("soup", {
			name: { en: "Training soup", nl: "Trainingssoep" },
			classification: "recipe",
			baseUnit: "serving",
			nutritionBasis: { kind: "perServing", label: { en: "Bowl", nl: "Kom" } },
			servings: [],
		});
		cache.receive(libraryRecordFromFood(food("oats"), 1));
		cache.receive(libraryRecordFromFood(recipe, 1));

		expect(cache.list({ classification: "recipe" })).toEqual([recipe]);
		expect(cache.search("trainings", "en").map((item) => item.id)).toEqual([
			"oats",
			"soup",
		]);
		expect(
			cache.search("trainings", "en", { classification: "ordinary" }),
		).toEqual([expect.objectContaining({ id: "oats" })]);
	});

	it("puts the most recently updated correction of a shipped food in front", () => {
		const cache = createPersonalFoodCache();
		const apple = getShippedFood("shipped:apple-w-skin-av");
		if (!apple) throw new Error("Expected the promoted apple in the library.");
		const fork = (id: string, updatedAt: number) => ({
			...normalizePersonalFoodDraft(forkShippedFood(apple)),
			id,
			createdAt: 1,
			updatedAt,
		});
		cache.receive(libraryRecordFromFood(food("own"), 1));
		cache.receive(libraryRecordFromFood(fork("first", 2_000), 1));
		cache.receive(libraryRecordFromFood(fork("second", 3_000), 1));

		expect(cache.forks().map((item) => item.id)).toEqual(["second", "first"]);
		expect(cache.findForkOf(apple.id)?.id).toBe("second");

		for (const id of ["first", "second"])
			cache.receive({
				id,
				kind: "food",
				payload: null,
				revision: 2,
				deleted: true,
			});
		expect(cache.findForkOf(apple.id)).toBeUndefined();
	});

	it("shows a combo part as unloaded until its food arrives, without following a replacement", () => {
		const cache = createPersonalFoodCache();
		cache.receive(
			combo("breakfast", [
				{
					id: "a",
					reference: { kind: "shipped", foodId: "shipped:gone" },
					snapshot: {
						...snapshot,
						provenance: {
							source: "shipped",
							sourceId: "shipped:gone",
							dataset: "NEVO",
							edition: "2025/9.0",
							sourceCode: 1,
							sourceName: snapshot.name,
							saltDerived: true,
						},
					},
				},
				{
					id: "b",
					reference: { kind: "personal", foodId: "oats" },
					snapshot: {
						...snapshot,
						provenance: {
							source: "personal",
							sourceId: "oats",
							nutritionSource: "manual",
							locallyEdited: false,
						},
					},
				},
				{ id: "c", reference: { kind: "oneOff" }, snapshot },
			]),
		);
		const statuses = () =>
			cache.findCombo("breakfast")?.parts.map((part) => part.status);

		expect(statuses()).toEqual(["missing", "unloaded", "available"]);
		cache.receive(libraryRecordFromFood(food("oats"), 1));
		expect(statuses()).toEqual(["missing", "available", "available"]);
		cache.receive(libraryRecordFromFood(food("replacement"), 1));
		cache.receive({
			id: "oats",
			kind: "food",
			payload: null,
			revision: 2,
			deleted: true,
		});
		expect(statuses()).toEqual(["missing", "unloaded", "available"]);
		expect(cache.findCombo("breakfast")?.parts[1].reference).toEqual({
			kind: "personal",
			foodId: "oats",
		});
	});
});
