import type {
	NUTRIENT_KEYS,
	NutrientValue,
	PersonalFoodDraft,
} from "@foundry/core";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import type { SyncSQLiteDatabase } from "./nutrition-database";
import { readLegacyPersonalFoods } from "./personal-food-session";

function nutrientStates(): Record<
	(typeof NUTRIENT_KEYS)[number],
	NutrientValue
> {
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

function draft(overrides: Partial<PersonalFoodDraft> = {}): PersonalFoodDraft {
	return {
		name: { en: "Training oats", nl: "Trainingshavermout" },
		baseUnit: "g",
		nutrients: nutrientStates(),
		servings: [
			{ label: { en: "Scoop", nl: "Schep" }, amount: 30 },
			{ label: { en: "Bowl", nl: "Kom" }, amount: 75.5 },
			{ label: { en: "Large bowl", nl: "Grote kom" }, amount: 110 },
		],
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
		},
		...overrides,
	};
}

/** The last file version (6; version 7 changed only the Combo table). */
function lastVersionFile() {
	const database = new SQLiteTestDatabase();
	database.execSync(`
		CREATE TABLE personal_foods (
			id TEXT PRIMARY KEY NOT NULL,
			name_en TEXT NOT NULL, name_nl TEXT NOT NULL,
			base_unit TEXT NOT NULL,
			nutrients_json TEXT NOT NULL, servings_json TEXT NOT NULL,
			provenance_json TEXT NOT NULL,
			classification TEXT NOT NULL,
			nutrition_basis_json TEXT NOT NULL,
			estimated INTEGER NOT NULL,
			description_json TEXT,
			visual_json TEXT,
			visual_migration_pending INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
		);
		PRAGMA user_version = 6;
	`);
	return database;
}

function insertFood(
	database: SyncSQLiteDatabase,
	id: string,
	food: PersonalFoodDraft,
) {
	database.runSync(
		`INSERT INTO personal_foods (id, name_en, name_nl, base_unit, nutrients_json,
			servings_json, provenance_json, classification, nutrition_basis_json,
			estimated, visual_json, visual_migration_pending, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 'ordinary', ?, 0, ?, 0, 10, 20)`,
		id,
		food.name.en,
		food.name.nl,
		food.baseUnit,
		JSON.stringify(food.nutrients),
		JSON.stringify(food.servings),
		JSON.stringify(food.provenance),
		JSON.stringify({ kind: "per100", unit: food.baseUnit }),
		food.visual ? JSON.stringify(food.visual) : null,
	);
}

describe("a library file from an earlier build", () => {
	it("lists its foods with their device photos and forgets one once removed", () => {
		const database = lastVersionFile();
		const legacy = readLegacyPersonalFoods(database);
		insertFood(
			database,
			"photo-oats",
			draft({ visual: { kind: "photo", uri: "file:///food-photos/oats.jpg" } }),
		);

		expect(readLegacyPersonalFoods(database).list()).toEqual([
			expect.objectContaining({
				id: "photo-oats",
				visual: { kind: "photo", uri: "file:///food-photos/oats.jpg" },
			}),
		]);
		legacy.remove("photo-oats");
		expect(legacy.list()).toEqual([]);
	});

	it("reads a version 3 food with the defaults of the later columns", () => {
		const database = new SQLiteTestDatabase();
		database.execSync(`
			CREATE TABLE personal_foods (
				id TEXT PRIMARY KEY, name_en TEXT, name_nl TEXT,
				base_unit TEXT CHECK (base_unit IN ('g', 'ml')),
				nutrients_json TEXT, servings_json TEXT, provenance_json TEXT,
				created_at INTEGER, updated_at INTEGER
			);
			PRAGMA user_version = 3;
		`);
		const old = draft({ baseUnit: "ml" });
		database.runSync(
			"INSERT INTO personal_foods VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			"legacy",
			old.name.en,
			old.name.nl,
			old.baseUnit,
			JSON.stringify(old.nutrients),
			JSON.stringify(old.servings),
			JSON.stringify(old.provenance),
			10,
			20,
		);
		const [food] = readLegacyPersonalFoods(database).list();
		expect(food).toMatchObject({
			id: "legacy",
			classification: "ordinary",
			nutritionBasis: { kind: "per100", unit: "ml" },
			estimated: false,
			nutrients: old.nutrients,
			createdAt: 10,
			updatedAt: 20,
		});
		expect(readLegacyPersonalFoods(database).list()).toEqual([food]);
	});

	it("reads the visual-only version 5 file", () => {
		const database = new SQLiteTestDatabase();
		database.execSync(`
			CREATE TABLE personal_foods (
				id TEXT PRIMARY KEY, name_en TEXT, name_nl TEXT,
				base_unit TEXT CHECK (base_unit IN ('g', 'ml')),
				nutrients_json TEXT, servings_json TEXT, provenance_json TEXT,
				visual_json TEXT, visual_migration_pending INTEGER NOT NULL DEFAULT 1,
				created_at INTEGER, updated_at INTEGER
			);
			CREATE INDEX personal_foods_by_updated ON personal_foods(updated_at DESC);
			PRAGMA user_version = 5;
		`);
		const old = draft({ visual: { kind: "icon", preset: "fruit" } });
		database.runSync(
			"INSERT INTO personal_foods VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			"visual-v5",
			old.name.en,
			old.name.nl,
			old.baseUnit,
			JSON.stringify(old.nutrients),
			JSON.stringify(old.servings),
			JSON.stringify(old.provenance),
			JSON.stringify(old.visual),
			0,
			10,
			20,
		);

		expect(readLegacyPersonalFoods(database).list()[0]).toMatchObject({
			classification: "ordinary",
			nutritionBasis: { kind: "per100", unit: "g" },
			estimated: false,
			visual: { kind: "icon", preset: "fruit" },
			createdAt: 10,
			updatedAt: 20,
		});
	});

	it("reads a version 1 file without rewriting it", () => {
		const database = new SQLiteTestDatabase();
		database.execSync(`
			CREATE TABLE personal_foods (
				id TEXT PRIMARY KEY NOT NULL,
				name_en TEXT NOT NULL,
				name_nl TEXT NOT NULL,
				base_unit TEXT NOT NULL,
				nutrients_json TEXT NOT NULL,
				servings_json TEXT NOT NULL,
				provenance_json TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
			PRAGMA user_version = 1;
		`);
		database.runSync(
			`INSERT INTO personal_foods
				(id, name_en, name_nl, base_unit, nutrients_json, servings_json, provenance_json, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			"58b7a219-67e5-42fc-9400-d740e8837df8",
			"Legacy oats",
			"Bestaande havermout",
			"g",
			JSON.stringify(nutrientStates()),
			"[]",
			JSON.stringify({
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			}),
			1,
			1,
		);

		expect(readLegacyPersonalFoods(database).list()[0]).toMatchObject({
			id: "58b7a219-67e5-42fc-9400-d740e8837df8",
			name: { en: "Legacy oats", nl: "Bestaande havermout" },
			nutrients: nutrientStates(),
		});
		expect(
			database
				.getAllSync<{ name: string }>("PRAGMA table_info(personal_foods)")
				.map((column) => column.name),
		).not.toContain("visual_json");
	});

	it("reads a file of a later version without changing its version", () => {
		const database = lastVersionFile();
		insertFood(database, "oats", draft());
		database.execSync("PRAGMA user_version = 8");
		expect(readLegacyPersonalFoods(database).list()).toEqual([
			expect.objectContaining({ id: "oats", name: draft().name }),
		]);
		expect(
			database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
				?.user_version,
		).toBe(8);
	});
});
