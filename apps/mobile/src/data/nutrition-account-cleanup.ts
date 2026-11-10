import { File } from "expo-file-system";
import { defaultDatabaseDirectory } from "expo-sqlite";
import { nutritionLibraryDatabaseName } from "./nutrition-library-repository";
import {
	hasUnuploadedPhoto,
	openLegacyPersonalFoods,
} from "./personal-food-repository";
import { discardPersonalFoodSources } from "./personal-food-session";

/** Remount providers after this call; account data refills from Convex. */
export function clearNutritionAccountCache(subject: string) {
	const file = new File(
		defaultDatabaseDirectory,
		nutritionLibraryDatabaseName(subject),
	);
	if (file.exists) {
		const cache = openLegacyPersonalFoods(
			nutritionLibraryDatabaseName(subject),
		);
		try {
			if (cache.list().some(hasUnuploadedPhoto))
				throw new Error("Upload device photos before clearing this cache.");
		} finally {
			cache.close();
		}
		discardPersonalFoodSources(subject);
	}
}
