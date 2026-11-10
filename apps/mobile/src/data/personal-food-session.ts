import {
	normalizePersonalFoodDraft,
	type PersonalFood,
	type PersonalFoodClassification,
} from "@foundry/core";
import { File } from "expo-file-system";
import { defaultDatabaseDirectory } from "expo-sqlite";
import { registerAccountStore } from "../local-store/local-store";
import {
	openNutritionDatabase,
	type SyncSQLiteDatabase,
} from "./nutrition-database";
import { nutritionLibraryDatabaseName } from "./nutrition-library-repository";
import {
	createPersonalFoodCache,
	type PersonalFoodCache,
} from "./personal-food-cache";
import { hasUnuploadedPhoto } from "./personal-food-model";

type PersonalFoodRow = {
	id: string;
	name_en: string;
	name_nl: string;
	base_unit: string;
	nutrients_json: string;
	servings_json: string;
	provenance_json: string;
	classification: PersonalFoodClassification;
	nutrition_basis_json: string;
	estimated: number;
	description_json: string | null;
	visual_json: string | null;
	visual_migration_pending: number;
	created_at: number;
	updated_at: number;
};

/** What a column added by a later file version reads as in an older file. */
const LATER_COLUMNS: Readonly<Record<string, string>> = {
	classification: "'ordinary'",
	nutrition_basis_json: `'{"kind":"per100","unit":"' || base_unit || '"}'`,
	estimated: "0",
	description_json: "NULL",
	visual_json: "NULL",
	visual_migration_pending: "1",
};

function rowToFood(row: PersonalFoodRow): PersonalFood {
	const draft = normalizePersonalFoodDraft({
		name: { en: row.name_en, nl: row.name_nl },
		baseUnit: row.base_unit as PersonalFood["baseUnit"],
		classification: row.classification,
		nutritionBasis: JSON.parse(row.nutrition_basis_json),
		estimated: row.estimated === 1,
		...(row.description_json
			? { description: JSON.parse(row.description_json) }
			: {}),
		nutrients: JSON.parse(row.nutrients_json),
		servings: JSON.parse(row.servings_json),
		provenance: JSON.parse(row.provenance_json),
		...(row.visual_json ? { visual: JSON.parse(row.visual_json) } : {}),
		...(row.visual_migration_pending === 1
			? { visualMigrationPending: true as const }
			: {}),
	});
	return {
		id: row.id,
		...draft,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/** A per-account library file an earlier build kept, read for its device photos. */
export type LegacyPersonalFoods = {
	list(): PersonalFood[];
	remove(id: string): void;
	close(): void;
};

/**
 * Reads the file as whichever version wrote it: every version kept the first
 * version's columns, and a column added later reads as its migration default.
 */
export function readLegacyPersonalFoods(
	database: SyncSQLiteDatabase,
): LegacyPersonalFoods {
	const present = new Set(
		database
			.getAllSync<{ name: string }>("PRAGMA table_info(personal_foods)")
			.map((column) => column.name),
	);
	const columns = Object.entries(LATER_COLUMNS)
		.map(([name, fallback]) =>
			present.has(name) ? name : `${fallback} AS ${name}`,
		)
		.join(", ");
	return {
		list: () =>
			present.size
				? database
						.getAllSync<PersonalFoodRow>(
							`SELECT id, name_en, name_nl, base_unit, nutrients_json,
								servings_json, provenance_json, created_at, updated_at, ${columns}
							FROM personal_foods ORDER BY updated_at DESC, id ASC`,
						)
						.map(rowToFood)
				: [],
		remove(id) {
			database.runSync("DELETE FROM personal_foods WHERE id = ?", id);
		},
		close() {
			database.closeSync?.();
		},
	};
}

function openLegacyPersonalFoods(databaseName: string) {
	return readLegacyPersonalFoods(openNutritionDatabase(databaseName));
}

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

function discardPersonalFoodSources(subject: string) {
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
