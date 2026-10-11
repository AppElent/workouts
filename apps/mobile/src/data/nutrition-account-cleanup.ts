import { foodPhotos } from "./food-photo-manager";
import { cleanLegacyRecipes } from "./legacy-recipe-migration";
import { NUTRITION_COOKING_DATABASE_NAME } from "./nutrition-cooking-repository";
import { openNutritionDatabase } from "./nutrition-database";
import { openNutritionDraftRepository } from "./nutrition-draft-repository";
import {
	createNutritionLibraryStateRepository,
	NUTRITION_LIBRARY_STATE_DATABASE_NAME,
} from "./nutrition-library-repository";
import { cleanLegacyLibrary } from "./nutrition-library-service";
import { openNutritionLocalRepository } from "./nutrition-local-repository";
import {
	createPersonalFoodRepository,
	PERSONAL_FOOD_DATABASE_NAME,
} from "./personal-food-repository";

/** Call only with account providers unmounted; every step is safe to retry. */
export function cleanUploadedNutritionAccount(subject: string) {
	const stateDatabase = openNutritionDatabase(
		NUTRITION_LIBRARY_STATE_DATABASE_NAME,
	);
	const state = createNutritionLibraryStateRepository(stateDatabase);
	const legacyDatabase = openNutritionDatabase(PERSONAL_FOOD_DATABASE_NAME);
	const legacy = createPersonalFoodRepository(legacyDatabase);
	const drafts = openNutritionDraftRepository();
	const local = openNutritionLocalRepository();
	const cooking = openNutritionDatabase(NUTRITION_COOKING_DATABASE_NAME);
	try {
		if (
			state.listOperations(subject).length ||
			state.listPrepared(subject).length ||
			state.listConflicts(subject).length ||
			drafts.pendingMigrations(subject).length ||
			local
				.listOperations(subject)
				.some((operation) => operation.status !== "acknowledged")
		)
			throw new Error("Some local data still needs uploading.");
		cleanLegacyRecipes(cooking, subject, state);
		cleanLegacyLibrary(subject, state, legacy);
		drafts.cleanAcknowledged(subject);
		local.cleanAcknowledged(subject);
	} finally {
		cooking.closeSync();
		local.close();
		drafts.close();
		legacyDatabase.closeSync();
		stateDatabase.closeSync();
	}
}

/** A confirmed test-account reset explicitly discards the owner's old sources. */
export function discardLegacyNutritionAccount(subject: string) {
	const stateDatabase = openNutritionDatabase(
		NUTRITION_LIBRARY_STATE_DATABASE_NAME,
	);
	const state = createNutritionLibraryStateRepository(stateDatabase);
	const legacyDatabase = openNutritionDatabase(PERSONAL_FOOD_DATABASE_NAME);
	const legacy = createPersonalFoodRepository(legacyDatabase);
	const cooking = openNutritionDatabase(NUTRITION_COOKING_DATABASE_NAME);
	try {
		if (state.legacyClaimedBy() === subject) {
			for (const food of legacy.list()) foodPhotos.remove(food.visual);
			legacy.replaceFromBackup({ foods: [], combos: [] });
		}
		cleanLegacyRecipes(cooking, subject);
	} finally {
		cooking.closeSync();
		legacyDatabase.closeSync();
		stateDatabase.closeSync();
	}
}
