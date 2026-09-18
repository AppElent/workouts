import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type PersonalFood,
	validatePersonalFoodDraft,
} from "@workouts/core/nutrition";
import { openDatabaseSync } from "expo-sqlite";
import { NUTRITION_COOKING_DATABASE_NAME } from "./nutrition-cooking-repository";
import { mintNutritionUuid } from "./nutrition-operation-service";
import type {
	PersonalFoodRepository,
	SyncSQLiteDatabase,
} from "./personal-food-repository";

type LegacyRecipeRow = {
	id: string;
	name_en: string;
	name_nl: string;
	version_en: string;
	version_nl: string;
	ingredients_json: string;
	yield_json: string;
	visual_json?: string | null;
	created_at: number;
	updated_at: number;
};

/** Read-only compatibility for the retired recipe table; no new recipe writes. */
function migratedFood(row: LegacyRecipeRow, id: string): PersonalFood {
	const ingredients = JSON.parse(row.ingredients_json) as {
		nutrients: Record<NutrientKey, NutrientValue>;
		estimated?: true;
	}[];
	const yieldValue = JSON.parse(row.yield_json) as {
		kind: "grams" | "portions";
		amount: number;
	};
	if (
		!ingredients.length ||
		!["grams", "portions"].includes(yieldValue.kind) ||
		!Number.isFinite(yieldValue.amount) ||
		yieldValue.amount <= 0
	) {
		throw new Error(`Legacy recipe ${row.id} has an invalid yield.`);
	}
	const factor = (yieldValue.kind === "grams" ? 100 : 1) / yieldValue.amount;
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		const values = ingredients.map((ingredient) => ingredient.nutrients[key]);
		if (values.some((value) => !value || value.kind === "absent")) {
			nutrients[key] = { kind: "absent" };
		} else {
			const measured = values.filter(
				(value): value is Extract<NutrientValue, { kind: "value" }> =>
					value.kind === "value",
			);
			const amount = measured.reduce((sum, value) => sum + value.amount, 0);
			nutrients[key] =
				amount === 0 && values.some((value) => value.kind === "trace")
					? { kind: "trace" }
					: { kind: "value", amount: amount * factor };
		}
	}
	return {
		id,
		...validatePersonalFoodDraft({
			name: { en: row.name_en, nl: row.name_nl },
			classification: "recipe",
			nutritionBasis:
				yieldValue.kind === "grams"
					? { kind: "per100", unit: "g" }
					: { kind: "perServing", label: { en: "Serving", nl: "Portie" } },
			baseUnit: yieldValue.kind === "grams" ? "g" : "serving",
			estimated: ingredients.some((ingredient) => ingredient.estimated),
			description: {
				en: row.version_en || row.name_en,
				nl: row.version_nl || row.name_nl,
			},
			nutrients,
			servings: [],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
			...(row.visual_json ? { visual: JSON.parse(row.visual_json) } : {}),
		}),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/**
 * Each account migrates only its own source rows into its isolated library.
 * Stable mappings precede the atomic library write, so interruption can replay
 * safely. Completion prevents a subsequently deleted food from resurrecting.
 * Sources remain untouched for a later cleanup release.
 */
export function migrateLegacyRecipes(
	database: SyncSQLiteDatabase,
	subject: string,
	repository: PersonalFoodRepository,
	mintId: () => string = mintNutritionUuid,
	reservedIds: readonly string[] = [],
): readonly string[] {
	database.execSync(`
		CREATE TABLE IF NOT EXISTS nutrition_recipe_migration_accounts (
			subject TEXT PRIMARY KEY NOT NULL,
			completed INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS nutrition_recipe_migration_ids (
			subject TEXT NOT NULL, recipe_id TEXT NOT NULL, food_id TEXT NOT NULL,
			PRIMARY KEY (subject, recipe_id), UNIQUE (subject, food_id)
		);
	`);
	const mappings = () =>
		database.getAllSync<{ recipe_id: string; food_id: string }>(
			"SELECT recipe_id, food_id FROM nutrition_recipe_migration_ids WHERE subject = ?",
			subject,
		);
	if (
		database.getFirstSync<{ completed: number }>(
			"SELECT completed FROM nutrition_recipe_migration_accounts WHERE subject = ?",
			subject,
		)?.completed
	) {
		return mappings().map((mapping) => mapping.food_id);
	}
	const hasRecipes = database.getFirstSync<{ name: string }>(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'nutrition_cooking_recipes'",
	);
	const rows = hasRecipes
		? database.getAllSync<LegacyRecipeRow>(
				"SELECT * FROM nutrition_cooking_recipes WHERE subject = ? ORDER BY id ASC",
				subject,
			)
		: [];
	const backup = repository.exportBackup();
	const foods = new Map(backup.foods.map((food) => [food.id, food]));
	const ids = new Set([
		...foods.keys(),
		...backup.combos.map((combo) => combo.id),
		...reservedIds,
	]);
	const knownMappings = new Map(
		mappings().map((mapping) => [mapping.recipe_id, mapping.food_id]),
	);
	for (const row of rows) {
		let id = knownMappings.get(row.id);
		if (!id) {
			id = row.id;
			while (ids.has(id)) id = mintId();
			// Validate before recording any progress for this row.
			migratedFood(row, id);
			database.runSync(
				"INSERT INTO nutrition_recipe_migration_ids(subject, recipe_id, food_id) VALUES (?, ?, ?)",
				subject,
				row.id,
				id,
			);
		}
		ids.add(id);
		if (!foods.has(id)) foods.set(id, migratedFood(row, id));
	}
	if (rows.length) {
		repository.replaceFromBackup(
			{
				foods: [
					...repository.list(),
					...[...foods.values()].filter((food) => !repository.find(food.id)),
				],
				combos: backup.combos,
			},
			{ preserveLocalPhotos: true },
		);
	}
	database.runSync(
		`INSERT INTO nutrition_recipe_migration_accounts(subject, completed) VALUES (?, 1)
		 ON CONFLICT(subject) DO UPDATE SET completed = 1`,
		subject,
	);
	return mappings().map((mapping) => mapping.food_id);
}

export function migrateDeviceRecipes(
	subject: string,
	repository: PersonalFoodRepository,
	reservedIds: readonly string[] = [],
): readonly string[] {
	const database = openDatabaseSync(NUTRITION_COOKING_DATABASE_NAME, {
		useNewConnection: true,
	});
	try {
		return migrateLegacyRecipes(
			database as SyncSQLiteDatabase,
			subject,
			repository,
			mintNutritionUuid,
			reservedIds,
		);
	} finally {
		database.closeSync();
	}
}
