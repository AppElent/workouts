import { openNutritionDatabase } from "./nutrition-database";
import type { SyncSQLiteDatabase } from "./personal-food-repository";

export const NUTRITION_COOKING_DATABASE_NAME = "workouts-nutrition-cooking.db";

export type NutritionCookingRepository = { close(): void };

/**
 * Retained only to open the historical database and create its v1 table.
 * Capture Draft behavior belongs to nutrition-draft-repository; the legacy
 * columns remain so notes written by older app versions survive upgrades.
 */
export function createNutritionCookingRepository(
	database: SyncSQLiteDatabase,
): NutritionCookingRepository {
	database.execSync(`
		CREATE TABLE IF NOT EXISTS nutrition_capture_drafts (
			subject TEXT NOT NULL,
			id TEXT NOT NULL,
			date TEXT NOT NULL,
			meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snacks')),
			note TEXT NOT NULL,
			conversion_client_entry_id TEXT,
			conversion_operation_id TEXT,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			PRIMARY KEY (subject, id)
		);
		CREATE INDEX IF NOT EXISTS nutrition_capture_drafts_by_date
			ON nutrition_capture_drafts(subject, date ASC, created_at ASC, id ASC);
	`);
	return {
		close() {
			(
				database as SyncSQLiteDatabase & { closeSync?: () => void }
			).closeSync?.();
		},
	};
}

export function openNutritionCookingRepository(): NutritionCookingRepository {
	return createNutritionCookingRepository(
		openNutritionDatabase(
			NUTRITION_COOKING_DATABASE_NAME,
		) as SyncSQLiteDatabase,
	);
}
