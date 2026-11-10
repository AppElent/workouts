import { File } from "expo-file-system";
import { defaultDatabaseDirectory } from "expo-sqlite";
import { registerAccountStore } from "../local-store/local-store";
import { nutritionLibraryDatabaseName } from "./nutrition-library-repository";
import {
	createPersonalFoodCache,
	type PersonalFoodCache,
} from "./personal-food-cache";
import {
	hasUnuploadedPhoto,
	type LegacyPersonalFoods,
	openLegacyPersonalFoods,
	type PersonalFood,
} from "./personal-food-repository";

export type PersonalFoodSession = {
	cache: PersonalFoodCache;
	close(): void;
};

/**
 * The account's library lives in memory. An account cache file from an
 * earlier build survives only while it holds photos not uploaded yet; those
 * foods join the session until the server has their photo.
 */
export function openPersonalFoodSession(subject?: string): PersonalFoodSession {
	const cache = createPersonalFoodCache();
	const file = subject
		? new File(defaultDatabaseDirectory, nutritionLibraryDatabaseName(subject))
		: undefined;
	let photoSources: LegacyPersonalFoods | undefined;
	if (file?.exists && subject) {
		photoSources = openLegacyPersonalFoods(
			nutritionLibraryDatabaseName(subject),
		);
		const pending = photoSources.list().filter(hasUnuploadedPhoto);
		if (pending.length) cache.keepDeviceFoods(pending);
		else {
			photoSources.close();
			photoSources = undefined;
			file.delete();
		}
	}
	const receive = cache.receive;
	return {
		cache: {
			...cache,
			receive(record) {
				const kept = receive(record);
				if (photoSources && kept.kind === "food" && kept.payload) {
					const food: PersonalFood = JSON.parse(kept.payload);
					if (
						food.visual &&
						food.visual.kind !== "icon" &&
						!hasUnuploadedPhoto(food)
					) {
						photoSources.remove(kept.id);
						if (!photoSources.list().some(hasUnuploadedPhoto)) {
							photoSources.close();
							photoSources = undefined;
							if (file?.exists) file.delete();
						}
					}
				}
				return kept;
			},
		},
		close() {
			photoSources?.close();
		},
	};
}

export function discardPersonalFoodSources(subject: string) {
	const file = new File(
		defaultDatabaseDirectory,
		nutritionLibraryDatabaseName(subject),
	);
	if (file.exists) file.delete();
}
registerAccountStore({
	name: "nutrition-library-sources",
	clear: discardPersonalFoodSources,
});
