import {
	type ComboDraft,
	type ComboPartDraft,
	type FoodVisual,
	type FoodVisualPresetId,
	normalizePersonalFoodDraft,
	type PersonalFood,
	type PersonalFoodClassification,
	type ShippedFood,
} from "@foundry/core";
import { registerLocalDatabase } from "../local-store/local-store";
import { openNutritionDatabase } from "./nutrition-database";

const DATABASE_VERSION = 6;

const SHIPPED_EMOJI_VISUALS: Readonly<Record<string, FoodVisualPresetId>> = {
	"🍎": "fruit",
	"🍇": "fruit",
	"🍓": "fruit",
	"🍍": "fruit",
	"🍌": "fruit",
	"🫐": "fruit",
	"🍋": "fruit",
	"🍒": "fruit",
	"🍑": "fruit",
	"🍊": "fruit",
	"🥬": "vegetable",
	"🍄": "vegetable",
	"🍅": "vegetable",
	"🧅": "vegetable",
	"🥕": "vegetable",
	"🍞": "grains",
	"🍚": "grains",
	"🍝": "grains",
	"🥣": "grains",
	"🍘": "grains",
	"🥛": "dairy",
	"🍮": "dairy",
	"🥚": "egg",
	"🥩": "meat",
	"🍗": "meat",
	"🌭": "meat",
	"🐟": "fish",
	"🍣": "fish",
	"🍰": "snack",
	"🍩": "snack",
	"🎂": "snack",
	"🍪": "snack",
	"🍨": "snack",
	"☕": "drink",
	"🧃": "drink",
	"🧈": "condiment",
	"🌻": "condiment",
};

export function foodVisualForShippedFood(
	food: Pick<ShippedFood, "emoji">,
): FoodVisual | undefined {
	const preset = food.emoji ? SHIPPED_EMOJI_VISUALS[food.emoji] : undefined;
	return preset ? { kind: "icon", preset } : undefined;
}

export type SQLiteValue = string | number | null | Uint8Array;

/** The synchronous subset shared by expo-sqlite and the real SQLite test adapter. */
export type SyncSQLiteDatabase = {
	closeSync?(): void;
	execSync(source: string): void;
	runSync(
		source: string,
		...params: SQLiteValue[]
	): { changes: number; lastInsertRowId: number };
	getFirstSync<T>(source: string, ...params: SQLiteValue[]): T | null;
	getAllSync<T>(source: string, ...params: SQLiteValue[]): T[];
};

export type {
	ComboDraft,
	ComboPartDraft,
	ComboPartReference,
	ComboPartSnapshot,
	FoodVisual,
	FoodVisualPresetId,
	PersonalFood,
	PersonalFoodClassification,
	PersonalFoodDraft,
	PersonalFoodProvenance,
	PersonalServing,
} from "@foundry/core";
export {
	FOOD_VISUAL_PRESET_IDS,
	normalizeComboDraft,
	normalizeFoodVisual,
	normalizePersonalFoodDraft,
} from "@foundry/core";

export type PersonalFoodFilter = {
	readonly classification?: PersonalFoodClassification;
};

/** A stored Combo part, with whether its source food is still at hand. */
export type ComboPart = Omit<ComboPartDraft, "id"> & {
	readonly id: string;
	readonly status: "available" | "missing" | "unloaded";
};

export type Combo = Omit<ComboDraft, "parts"> & {
	readonly id: string;
	readonly parts: readonly ComboPart[];
	readonly createdAt: number;
	readonly updatedAt: number;
};

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

function migrate(database: SyncSQLiteDatabase): void {
	const current =
		database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
			?.user_version ?? 0;
	if (current > DATABASE_VERSION) {
		// Schema 7 only adds an optional visual_json column to nutrition_combos.
		// Older code does not read or write that column, so it can safely use
		// this database as long as that known schema is present. Keep user_version
		// at 7; lowering it would make the next schema-7 migration fail.
		if (
			current === 7 &&
			database
				.getAllSync<{ name: string }>("PRAGMA table_info(nutrition_combos)")
				.some((column) => column.name === "visual_json")
		) {
			return;
		}
		throw new Error(
			`This nutrition database is newer than this version of Foundry (${current}).`,
		);
	}
	if (current === DATABASE_VERSION) return;

	database.execSync("BEGIN IMMEDIATE");
	try {
		if (current < 1) {
			database.execSync(`
				CREATE TABLE IF NOT EXISTS personal_foods (
					id TEXT PRIMARY KEY NOT NULL,
					name_en TEXT NOT NULL,
					name_nl TEXT NOT NULL,
					base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml')),
					nutrients_json TEXT NOT NULL,
					servings_json TEXT NOT NULL,
					provenance_json TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL
				);
				CREATE INDEX IF NOT EXISTS personal_foods_by_updated
					ON personal_foods(updated_at DESC);
			`);
		}
		if (current < 2) {
			// The bounded Open Food Facts request cache (spec #68 D23): its own
			// table in this same database and migration sequence, with a lifetime
			// wholly separate from Personal Foods — rows expire and are pruned
			// (see `openFoodFactsCache`), so this can never grow into a local
			// mirror of the provider's catalogue.
			database.execSync(`
				CREATE TABLE IF NOT EXISTS off_cache (
					cache_key TEXT PRIMARY KEY NOT NULL,
					kind TEXT NOT NULL CHECK (kind IN ('barcode', 'search')),
					response_json TEXT NOT NULL,
					fetched_at INTEGER NOT NULL,
					expires_at INTEGER NOT NULL
				);
				CREATE INDEX IF NOT EXISTS off_cache_by_expiry
					ON off_cache(expires_at ASC);
			`);
		}
		if (current < 3) {
			database.execSync(`
				CREATE TABLE IF NOT EXISTS nutrition_combos (
					id TEXT PRIMARY KEY NOT NULL,
					name TEXT NOT NULL,
					parts_json TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL
				);
				CREATE INDEX IF NOT EXISTS nutrition_combos_by_updated
					ON nutrition_combos(updated_at DESC);
			`);
		}
		if (current < 4) {
			// Rebuild to widen the old unit CHECK without losing IDs or timestamps.
			database.execSync(`
				CREATE TABLE personal_foods_v4 (
					id TEXT PRIMARY KEY NOT NULL,
					name_en TEXT NOT NULL, name_nl TEXT NOT NULL,
					base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'serving')),
					nutrients_json TEXT NOT NULL, servings_json TEXT NOT NULL,
					provenance_json TEXT NOT NULL,
					classification TEXT NOT NULL CHECK (classification IN ('ordinary', 'recipe')),
					nutrition_basis_json TEXT NOT NULL,
					estimated INTEGER NOT NULL CHECK (estimated IN (0, 1)),
					description_json TEXT,
					visual_json TEXT,
					visual_migration_pending INTEGER NOT NULL DEFAULT 1,
					created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
				);
				INSERT INTO personal_foods_v4
				SELECT id, name_en, name_nl, base_unit, nutrients_json, servings_json,
					provenance_json, 'ordinary', '{"kind":"per100","unit":"' || base_unit || '"}',
					0, NULL, NULL, 1, created_at, updated_at FROM personal_foods;
				DROP TABLE personal_foods;
				ALTER TABLE personal_foods_v4 RENAME TO personal_foods;
				CREATE INDEX personal_foods_by_updated ON personal_foods(updated_at DESC);
			`);
		}
		if (current === 4) {
			database.execSync(`
				ALTER TABLE personal_foods ADD COLUMN visual_json TEXT;
				ALTER TABLE personal_foods ADD COLUMN visual_migration_pending INTEGER NOT NULL DEFAULT 1;
			`);
		}
		if (current === 5) {
			// Version 5 existed briefly on the visual-feature branch before the
			// Personal Food Recipe migration landed. Preserve those visuals while
			// adding the canonical classification and nutrition-basis fields.
			database.execSync(`
				CREATE TABLE personal_foods_v6 (
					id TEXT PRIMARY KEY NOT NULL,
					name_en TEXT NOT NULL, name_nl TEXT NOT NULL,
					base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'serving')),
					nutrients_json TEXT NOT NULL, servings_json TEXT NOT NULL,
					provenance_json TEXT NOT NULL,
					classification TEXT NOT NULL CHECK (classification IN ('ordinary', 'recipe')),
					nutrition_basis_json TEXT NOT NULL,
					estimated INTEGER NOT NULL CHECK (estimated IN (0, 1)),
					description_json TEXT,
					visual_json TEXT,
					visual_migration_pending INTEGER NOT NULL DEFAULT 1,
					created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
				);
				INSERT INTO personal_foods_v6
				SELECT id, name_en, name_nl, base_unit, nutrients_json, servings_json,
					provenance_json, 'ordinary', '{"kind":"per100","unit":"' || base_unit || '"}',
					0, NULL, visual_json, visual_migration_pending, created_at, updated_at
				FROM personal_foods;
				DROP TABLE personal_foods;
				ALTER TABLE personal_foods_v6 RENAME TO personal_foods;
				CREATE INDEX personal_foods_by_updated ON personal_foods(updated_at DESC);
			`);
		}

		database.execSync(`PRAGMA user_version = ${DATABASE_VERSION}`);
		database.execSync("COMMIT");
	} catch (error) {
		database.execSync("ROLLBACK");
		throw error;
	}
}

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

/** A photo that so far exists only as a file on this device. */
export function hasUnuploadedPhoto(food: Pick<PersonalFood, "visual">) {
	return food.visual?.kind === "photo" && !food.visual.storageId;
}

/** A Personal Food safe to move to another device through account backup. */
export function portablePersonalFood(food: PersonalFood): PersonalFood {
	const { visualMigrationPending: _pending, visual, ...portable } = food;
	return {
		...portable,
		...(visual?.kind === "icon" || visual?.kind === "remote"
			? { visual }
			: visual?.kind === "photo" && visual.storageId
				? { visual: { ...visual, uri: "" } }
				: {}),
	};
}

/** A per-account library file an earlier build kept, read for its device photos. */
export type LegacyPersonalFoods = {
	list(): PersonalFood[];
	remove(id: string): void;
	close(): void;
};

export function readLegacyPersonalFoods(
	database: SyncSQLiteDatabase,
): LegacyPersonalFoods {
	migrate(database);
	return {
		list: () =>
			database
				.getAllSync<PersonalFoodRow>(
					"SELECT * FROM personal_foods ORDER BY updated_at DESC, id ASC",
				)
				.map(rowToFood),
		remove(id) {
			database.runSync("DELETE FROM personal_foods WHERE id = ?", id);
		},
		close() {
			database.closeSync?.();
		},
	};
}

export function openLegacyPersonalFoods(databaseName: string) {
	return readLegacyPersonalFoods(
		openNutritionDatabase(databaseName) as SyncSQLiteDatabase,
	);
}

export type OffCacheKind = "barcode" | "search";

export type OffCacheEntry = {
	readonly key: string;
	readonly kind: OffCacheKind;
	readonly response: unknown;
	readonly fetchedAt: number;
	readonly expiresAt: number;
};

export type OpenFoodFactsCache = {
	close?(): void;
	get(key: string): OffCacheEntry | undefined;
	set(key: string, kind: OffCacheKind, response: unknown): OffCacheEntry;
	/**
	 * Deletes expired rows, then — if still over the bound — the oldest
	 * survivors. Returns the number of rows removed.
	 */
	cleanup(): number;
};

/** Spec #68: "cached for seven days", with bounded cleanup so this table can never grow into a provider mirror. */
export const OFF_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const OFF_CACHE_MAX_ENTRIES = 200;

type OffCacheRow = {
	cache_key: string;
	kind: OffCacheKind;
	response_json: string;
	fetched_at: number;
	expires_at: number;
};

function rowToCacheEntry(row: OffCacheRow): OffCacheEntry {
	return {
		key: row.cache_key,
		kind: row.kind,
		response: JSON.parse(row.response_json),
		fetchedAt: row.fetched_at,
		expiresAt: row.expires_at,
	};
}

/**
 * The bounded Open Food Facts request cache (spec #68 D23). It has its own
 * database and lifetime: every row expires after
 * `OFF_CACHE_TTL_MS`, and `set` prunes both expired rows and, past
 * `OFF_CACHE_MAX_ENTRIES`, the oldest survivors — so it stays a short-lived
 * request cache, never an offline mirror of the provider's catalogue.
 */
export const OFF_REQUEST_CACHE_DATABASE_NAME = "workouts-off-cache.db";
registerLocalDatabase(OFF_REQUEST_CACHE_DATABASE_NAME);

export function createOpenFoodFactsCache(
	database: SyncSQLiteDatabase,
	options: { readonly now?: () => number } = {},
): OpenFoodFactsCache {
	database.execSync(`CREATE TABLE IF NOT EXISTS off_cache (cache_key TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('barcode','search')), response_json TEXT NOT NULL, fetched_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
		CREATE INDEX IF NOT EXISTS off_cache_by_expiry ON off_cache(expires_at ASC);`);
	const now = options.now ?? Date.now;

	function cleanup(): number {
		const timestamp = now();
		let removed = database.runSync(
			"DELETE FROM off_cache WHERE expires_at <= ?",
			timestamp,
		).changes;
		const remaining =
			database.getFirstSync<{ count: number }>(
				"SELECT COUNT(*) as count FROM off_cache",
			)?.count ?? 0;
		const overflow = remaining - OFF_CACHE_MAX_ENTRIES;
		if (overflow > 0) {
			removed += database.runSync(
				`DELETE FROM off_cache WHERE cache_key IN (
					SELECT cache_key FROM off_cache ORDER BY fetched_at ASC LIMIT ?
				)`,
				overflow,
			).changes;
		}
		return removed;
	}

	return {
		get(key) {
			const timestamp = now();
			const row = database.getFirstSync<OffCacheRow>(
				"SELECT * FROM off_cache WHERE cache_key = ?",
				key,
			);
			if (!row) return undefined;
			if (row.expires_at <= timestamp) {
				database.runSync("DELETE FROM off_cache WHERE cache_key = ?", key);
				return undefined;
			}
			return rowToCacheEntry(row);
		},
		set(key, kind, response) {
			const timestamp = now();
			const expiresAt = timestamp + OFF_CACHE_TTL_MS;
			database.runSync(
				`INSERT INTO off_cache (cache_key, kind, response_json, fetched_at, expires_at)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT(cache_key) DO UPDATE SET
					kind = excluded.kind,
					response_json = excluded.response_json,
					fetched_at = excluded.fetched_at,
					expires_at = excluded.expires_at`,
				key,
				kind,
				JSON.stringify(response),
				timestamp,
				expiresAt,
			);
			cleanup();
			return { key, kind, response, fetchedAt: timestamp, expiresAt };
		},
		cleanup,
		close() {
			database.closeSync?.();
		},
	};
}

/** A bounded provider request cache, separate from retired account copies. */
export function openOpenFoodFactsCache(): OpenFoodFactsCache {
	return createOpenFoodFactsCache(
		openNutritionDatabase(
			OFF_REQUEST_CACHE_DATABASE_NAME,
		) as SyncSQLiteDatabase,
	);
}
