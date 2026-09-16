import type { NutrientKey, NutrientValue } from "@workouts/core/nutrition";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import { migrateLegacyRecipes } from "./legacy-recipe-migration";
import { resolveComboPart } from "./nutrition-combo";
import { createNutritionLibraryStateRepository } from "./nutrition-library-repository";
import { NutritionLibraryService } from "./nutrition-library-service";
import { personalFoodLibraryView } from "./personal-food-library-view";
import { createPersonalFoodRepository } from "./personal-food-repository";

const nutrients: Record<NutrientKey, NutrientValue> = {
	energy: { kind: "value", amount: 400 },
	protein: { kind: "trace" },
	carbs: { kind: "absent" },
	fat: { kind: "value", amount: 8 },
	saturatedFat: { kind: "absent" },
	fibre: { kind: "value", amount: 2 },
	sugars: { kind: "trace" },
	salt: { kind: "value", amount: 0 },
};

function source() {
	const database = new SQLiteTestDatabase();
	database.execSync(`CREATE TABLE nutrition_cooking_recipes (
		subject TEXT, id TEXT, name_en TEXT, name_nl TEXT,
		version_en TEXT, version_nl TEXT, ingredients_json TEXT, yield_json TEXT,
		created_at INTEGER, updated_at INTEGER, PRIMARY KEY(subject, id)
	);`);
	const add = (
		subject: string,
		id: string,
		kind: "grams" | "portions",
		amount: number,
	) => {
		database.runSync(
			"INSERT INTO nutrition_cooking_recipes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			subject,
			id,
			"Porridge",
			"Havermoutpap",
			"Weekday",
			"Doordeweeks",
			JSON.stringify([{ nutrients }]),
			JSON.stringify({ kind, amount }),
			10,
			20,
		);
	};
	return { database, add };
}

describe("legacy Recipe migration through the Personal Library", () => {
	it("preserves IDs, bilingual version descriptions, gram and serving meaning without claiming estimates", () => {
		const { database, add } = source();
		add("a", "grams", "grams", 250);
		add("a", "portions", "portions", 4);
		add("b", "other-account", "grams", 100);
		const destination = new SQLiteTestDatabase();
		const repository = createPersonalFoodRepository(destination);
		expect(migrateLegacyRecipes(database, "a", repository)).toEqual([
			"grams",
			"portions",
		]);
		const reopened = createPersonalFoodRepository(destination);
		expect(reopened.find("grams")).toMatchObject({
			id: "grams",
			classification: "recipe",
			estimated: false,
			baseUnit: "g",
			nutritionBasis: { kind: "per100", unit: "g" },
			description: { en: "Weekday", nl: "Doordeweeks" },
			nutrients: {
				energy: { kind: "value", amount: 160 },
				protein: { kind: "trace" },
				carbs: { kind: "absent" },
				salt: { kind: "value", amount: 0 },
			},
			createdAt: 10,
			updatedAt: 20,
		});
		expect(reopened.find("portions")).toMatchObject({
			baseUnit: "serving",
			nutritionBasis: {
				kind: "perServing",
				label: { en: "Serving", nl: "Portie" },
			},
			nutrients: { energy: { kind: "value", amount: 100 } },
		});
		expect(reopened.find("other-account")).toBeUndefined();
		expect(
			database.getFirstSync<{ count: number }>(
				"SELECT COUNT(*) AS count FROM nutrition_cooking_recipes",
			)?.count,
		).toBe(3);
		const b = createPersonalFoodRepository(new SQLiteTestDatabase());
		migrateLegacyRecipes(database, "b", b);
		expect(b.list().map((food) => food.id)).toEqual(["other-account"]);
	});

	it("is idempotent after edits and deletion, and queues only when account backup is enabled", () => {
		const { database, add } = source();
		add("a", "recipe", "portions", 2);
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		migrateLegacyRecipes(database, "a", repository);
		expect(state.listOperations("a")).toEqual([]);
		expect(state.legacyClaimedBy()).toBeUndefined();
		const food = repository.find("recipe");
		if (!food) throw new Error("Migration failed");
		repository.update(food.id, { ...food, estimated: true });
		migrateLegacyRecipes(database, "a", repository);
		expect(repository.find(food.id)?.estimated).toBe(true);
		state.setEnabled("a", true);
		const service = new NutritionLibraryService(
			"a",
			state,
			repository,
			async () => {
				throw new Error("offline");
			},
		);
		expect(state.listOperations("a")).toMatchObject([
			{ recordId: food.id, schemaVersion: 2 },
		]);
		repository.remove(food.id);
		service.remove(food.id, "food");
		migrateLegacyRecipes(database, "a", repository);
		expect(repository.find(food.id)).toBeUndefined();
		expect(state.getRecord("a", food.id)?.deleted).toBe(true);
	});

	it("replays an interrupted cross-database write with a stable collision mapping", () => {
		const { database, add } = source();
		add("a", "collision", "grams", 100);
		const repository = createPersonalFoodRepository(new SQLiteTestDatabase());
		repository.create(
			{
				name: { en: "Existing", nl: "Bestaand" },
				baseUnit: "g",
				nutrients,
				servings: [],
				provenance: {
					recordOrigin: "personal",
					nutritionSource: "manual",
					locallyEdited: false,
				},
			},
			"collision",
		);
		const write = jest
			.spyOn(repository, "replaceFromBackup")
			.mockImplementationOnce(() => {
				throw new Error("interrupted");
			});
		expect(() =>
			migrateLegacyRecipes(database, "a", repository, () => "new-id"),
		).toThrow("interrupted");
		write.mockRestore();
		expect(
			migrateLegacyRecipes(database, "a", repository, () => "must-not-use"),
		).toEqual(["new-id"]);
		expect(repository.find("collision")?.name.en).toBe("Existing");
		expect(repository.find("new-id")?.classification).toBe("recipe");
	});

	it("keeps unclaimed legacy visibility and account recipe mutations separate before backup", () => {
		const { database, add } = source();
		add("a", "recipe-a", "grams", 100);
		add("b", "recipe-b", "grams", 100);
		const legacy = createPersonalFoodRepository(new SQLiteTestDatabase());
		legacy.create(
			{
				name: { en: "Old food", nl: "Oud eten" },
				baseUnit: "g",
				nutrients,
				servings: [],
				provenance: {
					recordOrigin: "personal",
					nutritionSource: "manual",
					locallyEdited: false,
				},
			},
			"legacy",
		);
		const accountA = createPersonalFoodRepository(new SQLiteTestDatabase());
		const accountB = createPersonalFoodRepository(new SQLiteTestDatabase());
		migrateLegacyRecipes(database, "a", accountA);
		migrateLegacyRecipes(database, "b", accountB);
		const a = personalFoodLibraryView(legacy, accountA);
		const b = personalFoodLibraryView(legacy, accountB);
		expect(
			a
				.list()
				.map((food) => food.id)
				.sort(),
		).toEqual(["legacy", "recipe-a"]);
		expect(
			b
				.list()
				.map((food) => food.id)
				.sort(),
		).toEqual(["legacy", "recipe-b"]);
		const recipe = a.find("recipe-a");
		if (!recipe) throw new Error("Recipe missing");
		a.update(recipe.id, { ...recipe, estimated: true });
		const combo = a.createCombo({
			name: "Breakfast",
			parts: [
				{
					reference: { kind: "personal", foodId: recipe.id },
					snapshot: {
						name: recipe.name,
						serving: { en: "100 g", nl: "100 g" },
						quantity: 1,
						amount: 100,
						baseUnit: "g",
						nutrients,
						provenance: {
							source: "personal",
							sourceId: recipe.id,
							nutritionSource: "manual",
							locallyEdited: false,
						},
					},
				},
			],
		});
		expect(combo.parts[0].status).toBe("available");
		expect(a.findCombo(combo.id)?.parts[0].status).toBe("available");
		expect(a.listCombos()[0]?.parts[0].status).toBe("available");
		expect(resolveComboPart(combo.parts[0], a.find)).toMatchObject({
			estimated: true,
			nutrients: recipe.nutrients,
		});
		expect(b.findCombo(combo.id)).toBeUndefined();
		expect(legacy.findCombo(combo.id)).toBeUndefined();
		const legacyCombo = legacy.createCombo({
			name: "Previously shared",
			parts: [
				{
					reference: { kind: "oneOff" },
					snapshot: {
						...combo.parts[0].snapshot,
						provenance: { source: "oneOff" },
					},
				},
			],
		});
		a.updateCombo(legacyCombo.id, {
			name: "Now account owned",
			parts: combo.parts,
		});
		expect(a.findCombo(legacyCombo.id)?.parts[0].status).toBe("available");
		expect(b.findCombo(legacyCombo.id)).toBeUndefined();
		expect(legacy.findCombo(legacyCombo.id)).toBeUndefined();
		expect(accountA.find(recipe.id)?.estimated).toBe(true);
		expect(legacy.find(recipe.id)).toBeUndefined();
		expect(b.find(recipe.id)).toBeUndefined();
		expect(
			a.search("Porridge", "en", { classification: "recipe" }),
		).toHaveLength(1);
		a.remove(recipe.id);
		expect(accountA.find(recipe.id)).toBeUndefined();
		expect(legacy.find("legacy")).toBeDefined();
	});
});
