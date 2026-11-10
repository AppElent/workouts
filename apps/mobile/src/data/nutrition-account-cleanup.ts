import { File } from "expo-file-system";
import { defaultDatabaseDirectory } from "expo-sqlite";
import { nutritionLibraryDatabaseName } from "./nutrition-library-repository";
import { openPersonalFoodRepository } from "./personal-food-repository";
import { discardPersonalFoodSources } from "./personal-food-session";

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
}
