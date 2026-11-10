import { registerLocalDatabase } from "../local-store/local-store";
import {
	openNutritionDatabase,
	type SyncSQLiteDatabase,
} from "./nutrition-database";

type OffCacheKind = "barcode" | "search";

type OffCacheEntry = {
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
 * The bounded Open Food Facts request cache. It has its own
 * database and lifetime: every row expires after
 * `OFF_CACHE_TTL_MS`, and `set` prunes both expired rows and, past
 * `OFF_CACHE_MAX_ENTRIES`, the oldest survivors — so it stays a short-lived
 * request cache, never an offline mirror of the provider's catalogue.
 */
const OFF_REQUEST_CACHE_DATABASE_NAME = "workouts-off-cache.db";
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
		openNutritionDatabase(OFF_REQUEST_CACHE_DATABASE_NAME),
	);
}
