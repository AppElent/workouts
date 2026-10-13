import { File } from "expo-file-system";
import { defaultDatabaseDirectory } from "expo-sqlite";
import {
	type LibraryRecord,
	nutritionLibraryDatabaseName,
} from "./nutrition-library-repository";
import {
	openPersonalFoodRepository,
	type PersonalFood,
	type PersonalFoodRepository,
} from "./personal-food-repository";

export type PersonalFoodSession = {
	repository: PersonalFoodRepository;
	acknowledged(record: LibraryRecord): void;
	close(): void;
};

/** Account records use session memory. An old file survives only for unuploaded manual photos. */
export function openPersonalFoodSession(subject?: string): PersonalFoodSession {
	const repository = openPersonalFoodRepository(":memory:", {
		partialCache: true,
	});
	const file = subject
		? new File(defaultDatabaseDirectory, nutritionLibraryDatabaseName(subject))
		: undefined;
	let photoSources: PersonalFoodRepository | undefined;
	if (file?.exists && subject) {
		photoSources = openPersonalFoodRepository(
			nutritionLibraryDatabaseName(subject),
			{ partialCache: true },
		);
		const pending = photoSources
			.list()
			.filter(
				(food) =>
					food.visual?.kind === "photo" &&
					!food.visual.storageId &&
					food.provenance.nutritionSource !== "openfoodfacts",
			);
		if (pending.length)
			repository.replaceFromBackup(
				{ foods: pending, combos: [] },
				{ merge: true, preserveLocalPhotos: true },
			);
		else {
			photoSources.close?.();
			photoSources = undefined;
			file.delete();
		}
	}
	return {
		repository,
		acknowledged(record) {
			if (!photoSources || record.kind !== "food" || !record.payload) return;
			const food: PersonalFood = JSON.parse(record.payload);
			if (
				food.visual?.kind !== "remote" &&
				!(food.visual?.kind === "photo" && food.visual.storageId)
			)
				return;
			photoSources.remove(record.id);
			if (
				photoSources
					.list()
					.every(
						(candidate) =>
							candidate.visual?.kind !== "photo" ||
							!!candidate.visual.storageId ||
							candidate.provenance.nutritionSource === "openfoodfacts",
					)
			) {
				photoSources.close?.();
				photoSources = undefined;
				if (file?.exists) file.delete();
			}
		},
		close() {
			repository.close?.();
			photoSources?.close?.();
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
