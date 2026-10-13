import { File } from "expo-file-system";
import { defaultDatabaseDirectory } from "expo-sqlite";
import { openNutritionDatabase } from "./nutrition-database";
import { nutritionLibraryDatabaseName } from "./nutrition-library-repository";
import { openPersonalFoodRepository } from "./personal-food-repository";
import { discardPersonalFoodSources } from "./personal-food-session";

/** Empty migration sources can be retired; unknown originals remain untouched. */
export function retireLegacyNutritionData() {
	for (const [name, sourceTables] of [
		["workouts-nutrition.db", ["personal_foods", "nutrition_combos"]],
		[
			"workouts-nutrition-cooking.db",
			["nutrition_capture_drafts", "nutrition_cooking_recipes"],
		],
	] as const) {
		const file = new File(defaultDatabaseDirectory, name);
		if (!file.exists) continue;
		const database = openNutritionDatabase(name);
		let empty = true;
		try {
			for (const table of sourceTables) {
				if (
					database.getFirstSync(
						"SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
						table,
					) &&
					database.getFirstSync(`SELECT 1 FROM ${table} LIMIT 1`)
				)
					empty = false;
			}
		} finally {
			database.closeSync();
		}
		if (empty) file.delete();
	}
}

/** Remount providers after this call; account data refills from Convex. */
export function clearNutritionAccountCache(subject: string) {
	const file = new File(
		defaultDatabaseDirectory,
		nutritionLibraryDatabaseName(subject),
	);
	if (file.exists) {
		const cache = openPersonalFoodRepository(
			nutritionLibraryDatabaseName(subject),
			{ partialCache: true },
		);
		try {
			if (
				cache
					.list()
					.some(
						(food) =>
							food.visual?.kind === "photo" &&
							!food.visual.storageId &&
							food.provenance.nutritionSource !== "openfoodfacts",
					)
			)
				throw new Error("Upload device photos before clearing this cache.");
		} finally {
			cache.close?.();
		}
		discardPersonalFoodSources(subject);
	}
	retireLegacyNutritionData();
}
