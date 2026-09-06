import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type ShippedFoodId,
} from "@workouts/core/nutrition";
import { openDatabaseSync } from "expo-sqlite";

export const PERSONAL_FOOD_DATABASE_NAME = "workouts-nutrition.db";
const DATABASE_VERSION = 2;

export type SQLiteValue = string | number | null | Uint8Array;

/** The synchronous subset shared by expo-sqlite and the real SQLite test adapter. */
export type SyncSQLiteDatabase = {
	execSync(source: string): void;
	runSync(
		source: string,
		...params: SQLiteValue[]
	): { changes: number; lastInsertRowId: number };
	getFirstSync<T>(source: string, ...params: SQLiteValue[]): T | null;
	getAllSync<T>(source: string, ...params: SQLiteValue[]): T[];
};

export type PersonalServing = {
	readonly label: { readonly en: string; readonly nl: string };
	/** Positive amount in the Personal Food's base unit. */
	readonly amount: number;
};

/**
 * Provenance fields are stored together so #75 and #76 can retain a shipped
 * ancestor or provider attribution without another SQLite migration.
 */
export type PersonalFoodProvenance = {
	readonly recordOrigin: "personal" | "import";
	readonly nutritionSource: "manual" | "nevo" | "openfoodfacts";
	readonly locallyEdited: boolean;
	readonly forkedFrom?: ShippedFoodId;
	readonly provider?: string;
	readonly barcode?: string;
	readonly attribution?: string;
};

export type PersonalFoodDraft = {
	readonly name: { readonly en: string; readonly nl: string };
	readonly baseUnit: "g" | "ml";
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly servings: readonly PersonalServing[];
	readonly provenance: PersonalFoodProvenance;
};

export type PersonalFood = PersonalFoodDraft & {
	readonly id: string;
	readonly createdAt: number;
	readonly updatedAt: number;
};

export type PersonalFoodRepository = {
	list(): PersonalFood[];
	find(id: string): PersonalFood | undefined;
	/** The Personal Food whose provenance carries this barcode, if any. */
	findByBarcode(barcode: string): PersonalFood | undefined;
	search(query: string, locale: "en" | "nl"): PersonalFood[];
	create(draft: PersonalFoodDraft): PersonalFood;
	update(id: string, draft: PersonalFoodDraft): PersonalFood;
	remove(id: string): boolean;
};

type PersonalFoodRow = {
	id: string;
	name_en: string;
	name_nl: string;
	base_unit: string;
	nutrients_json: string;
	servings_json: string;
	provenance_json: string;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	readonly mintUuid?: () => string;
	readonly now?: () => number;
};

function migrate(database: SyncSQLiteDatabase): void {
	const current =
		database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
			?.user_version ?? 0;
	if (current > DATABASE_VERSION) {
		throw new Error(
			`This nutrition database is newer than this version of Workouts (${current}).`,
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
		database.execSync(`PRAGMA user_version = ${DATABASE_VERSION}`);
		database.execSync("COMMIT");
	} catch (error) {
		database.execSync("ROLLBACK");
		throw error;
	}
}

function validateText(value: unknown, label: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${label} is required.`);
	}
	return value.trim();
}

function validateNutrient(value: unknown, label: string): NutrientValue {
	if (!value || typeof value !== "object" || !("kind" in value)) {
		throw new Error(`${label} must have a nutrient state.`);
	}
	if (value.kind === "absent") return { kind: "absent" };
	if (value.kind === "trace") return { kind: "trace" };
	if (value.kind !== "value" || !("amount" in value)) {
		throw new Error(`${label} must have a nutrient state.`);
	}
	if (
		typeof value.amount !== "number" ||
		!Number.isFinite(value.amount) ||
		value.amount < 0
	) {
		throw new Error(`${label} must be zero or greater.`);
	}
	return { kind: "value", amount: value.amount };
}

function validateProvenance(value: unknown): PersonalFoodProvenance {
	if (!value || typeof value !== "object") {
		throw new Error("Food provenance is required.");
	}
	const candidate = value as Partial<PersonalFoodProvenance>;
	if (
		candidate.recordOrigin !== "personal" &&
		candidate.recordOrigin !== "import"
	) {
		throw new Error("Food provenance has an invalid record origin.");
	}
	if (
		candidate.nutritionSource !== "manual" &&
		candidate.nutritionSource !== "nevo" &&
		candidate.nutritionSource !== "openfoodfacts"
	) {
		throw new Error("Food provenance has an invalid nutrition source.");
	}
	if (typeof candidate.locallyEdited !== "boolean") {
		throw new Error("Food provenance must say whether it was edited locally.");
	}
	return {
		recordOrigin: candidate.recordOrigin,
		nutritionSource: candidate.nutritionSource,
		locallyEdited: candidate.locallyEdited,
		...(candidate.forkedFrom ? { forkedFrom: candidate.forkedFrom } : {}),
		...(candidate.provider ? { provider: candidate.provider } : {}),
		...(candidate.barcode ? { barcode: candidate.barcode } : {}),
		...(candidate.attribution ? { attribution: candidate.attribution } : {}),
	};
}

export function validatePersonalFoodDraft(
	draft: PersonalFoodDraft,
): PersonalFoodDraft {
	if (draft.baseUnit !== "g" && draft.baseUnit !== "ml") {
		throw new Error("Base unit must be grams or millilitres.");
	}
	if (!Array.isArray(draft.servings) || draft.servings.length > 3) {
		throw new Error("A Personal Food can have up to three Servings.");
	}
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		nutrients[key] = validateNutrient(draft.nutrients[key], key);
	}
	const servings = draft.servings.map((serving, index) => {
		if (!Number.isFinite(serving.amount) || serving.amount <= 0) {
			throw new Error(`Serving ${index + 1} amount must be greater than zero.`);
		}
		return {
			label: {
				en: validateText(
					serving.label.en,
					`Serving ${index + 1} English label`,
				),
				nl: validateText(serving.label.nl, `Serving ${index + 1} Dutch label`),
			},
			amount: serving.amount,
		};
	});
	return {
		name: {
			en: validateText(draft.name.en, "English name"),
			nl: validateText(draft.name.nl, "Dutch name"),
		},
		baseUnit: draft.baseUnit,
		nutrients,
		servings,
		provenance: validateProvenance(draft.provenance),
	};
}

function rowToFood(row: PersonalFoodRow): PersonalFood {
	const draft = validatePersonalFoodDraft({
		name: { en: row.name_en, nl: row.name_nl },
		baseUnit: row.base_unit as "g" | "ml",
		nutrients: JSON.parse(row.nutrients_json),
		servings: JSON.parse(row.servings_json),
		provenance: JSON.parse(row.provenance_json),
	});
	return {
		id: row.id,
		...draft,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function mintUuid(): string {
	const bytes = new Uint8Array(16);
	if (globalThis.crypto?.getRandomValues) {
		globalThis.crypto.getRandomValues(bytes);
	} else {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256);
		}
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function createPersonalFoodRepository(
	database: SyncSQLiteDatabase,
	options: RepositoryOptions = {},
): PersonalFoodRepository {
	migrate(database);
	const nextUuid = options.mintUuid ?? mintUuid;
	const now = options.now ?? Date.now;

	function find(id: string): PersonalFood | undefined {
		const row = database.getFirstSync<PersonalFoodRow>(
			"SELECT * FROM personal_foods WHERE id = ?",
			id,
		);
		return row ? rowToFood(row) : undefined;
	}

	return {
		list() {
			return database
				.getAllSync<PersonalFoodRow>(
					"SELECT * FROM personal_foods ORDER BY updated_at DESC, id ASC",
				)
				.map(rowToFood);
		},
		find,
		findByBarcode(barcode) {
			// Barcodes live inside the JSON provenance blob rather than their own
			// column, so this filters in JS like `search` does — consistent with
			// the rest of the repository. A barcode lookup is one row against a
			// small on-device table, not a hot path that needs its own index.
			return this.list().find((food) => food.provenance.barcode === barcode);
		},
		search(query, locale) {
			const needle = query.trim().toLocaleLowerCase(locale);
			if (needle.length === 0) return this.list();
			return this.list()
				.filter((food) =>
					[food.name[locale], food.name[locale === "en" ? "nl" : "en"]].some(
						(name) => name.toLocaleLowerCase(locale).includes(needle),
					),
				)
				.sort((left, right) =>
					left.name[locale].localeCompare(right.name[locale], locale),
				);
		},
		create(draft) {
			const valid = validatePersonalFoodDraft(draft);
			const id = nextUuid();
			const timestamp = now();
			database.runSync(
				`INSERT INTO personal_foods
					(id, name_en, name_nl, base_unit, nutrients_json, servings_json, provenance_json, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				id,
				valid.name.en,
				valid.name.nl,
				valid.baseUnit,
				JSON.stringify(valid.nutrients),
				JSON.stringify(valid.servings),
				JSON.stringify(valid.provenance),
				timestamp,
				timestamp,
			);
			return {
				id,
				...valid,
				createdAt: timestamp,
				updatedAt: timestamp,
			};
		},
		update(id, draft) {
			const existing = find(id);
			if (!existing) throw new Error("Personal Food not found.");
			const valid = validatePersonalFoodDraft(draft);
			const timestamp = now();
			database.runSync(
				`UPDATE personal_foods
				 SET name_en = ?, name_nl = ?, base_unit = ?, nutrients_json = ?,
				     servings_json = ?, provenance_json = ?, updated_at = ?
				 WHERE id = ?`,
				valid.name.en,
				valid.name.nl,
				valid.baseUnit,
				JSON.stringify(valid.nutrients),
				JSON.stringify(valid.servings),
				JSON.stringify(valid.provenance),
				timestamp,
				id,
			);
			return {
				id,
				...valid,
				createdAt: existing.createdAt,
				updatedAt: timestamp,
			};
		},
		remove(id) {
			return (
				database.runSync("DELETE FROM personal_foods WHERE id = ?", id)
					.changes > 0
			);
		},
	};
}

/** Open the one device database shared by Personal Foods and later local Nutrition data. */
export function openPersonalFoodRepository(): PersonalFoodRepository {
	return createPersonalFoodRepository(
		openDatabaseSync(PERSONAL_FOOD_DATABASE_NAME) as SyncSQLiteDatabase,
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
 * The bounded Open Food Facts request cache (spec #68 D23). It shares its
 * migration sequence and its underlying database with Personal Foods, but has
 * its own table and its own lifetime: every row expires after
 * `OFF_CACHE_TTL_MS`, and `set` prunes both expired rows and, past
 * `OFF_CACHE_MAX_ENTRIES`, the oldest survivors — so it stays a short-lived
 * request cache, never an offline mirror of the provider's catalogue.
 */
export function createOpenFoodFactsCache(
	database: SyncSQLiteDatabase,
	options: RepositoryOptions = {},
): OpenFoodFactsCache {
	migrate(database);
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
	};
}

/** Open the same on-device database `openPersonalFoodRepository` uses, for the Open Food Facts request cache. */
export function openOpenFoodFactsCache(): OpenFoodFactsCache {
	return createOpenFoodFactsCache(
		openDatabaseSync(PERSONAL_FOOD_DATABASE_NAME) as SyncSQLiteDatabase,
	);
}
