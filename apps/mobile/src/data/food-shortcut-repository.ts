import type { BaseUnit, Bilingual, MealSlot } from "@foundry/core";
import {
	registerAccountStore,
	registerLocalDatabase,
} from "../local-store/local-store";
import { reportError } from "../observability/errors";
import {
	openNutritionDatabase,
	type SyncSQLiteDatabase,
} from "./nutrition-database";

export const FOOD_SHORTCUT_DATABASE_NAME = "workouts-nutrition-state.db";
const DATABASE_VERSION = 9;

export type PortionMemory = {
	readonly kind:
		| "authored"
		| "base-unit"
		| "personal-measure"
		| "supplementary";
	readonly servingKey: string;
	readonly baseUnit: BaseUnit;
	readonly amount: number;
	readonly quantity: number;
	readonly label: Bilingual;
};

/** A food or Combo logged directly, remembered as a shortcut for the next log. */
export type FoodUse = {
	readonly sourceKey: string;
	readonly portion: PortionMemory;
};

export type FoodShortcut = {
	readonly sourceKey: string;
	readonly lastUsedAt?: number;
	readonly portion?: PortionMemory;
	readonly favorite: boolean;
};

export type FoodShortcutRepository = {
	recordUse(subject: string, use: FoodUse, meal: MealSlot): void;
	/** Newest first; with a meal, what was logged to that meal leads. */
	listRecent(subject: string, meal?: MealSlot): FoodShortcut[];
	listFavorites(subject: string): FoodShortcut[];
	get(subject: string, sourceKey: string): FoodShortcut | undefined;
	setFavorite(subject: string, sourceKey: string, favorite: boolean): void;
	clear(subject: string): void;
	close(): void;
};

type ShortcutRow = {
	source_key: string;
	last_used_at: number | null;
	portion_json: string | null;
	favorite: number;
};

function rowToShortcut(row: ShortcutRow): FoodShortcut {
	return {
		sourceKey: row.source_key,
		...(row.last_used_at === null ? {} : { lastUsedAt: row.last_used_at }),
		...(row.portion_json
			? { portion: JSON.parse(row.portion_json) as PortionMemory }
			: {}),
		favorite: row.favorite === 1,
	};
}

class NewerShortcutDatabaseError extends Error {
	constructor(readonly version: number) {
		super(
			`This food shortcut database (${version}) is newer than this app (${DATABASE_VERSION}).`,
		);
		this.name = "NewerShortcutDatabaseError";
	}
}

function migrate(database: SyncSQLiteDatabase) {
	const version =
		database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
			?.user_version ?? 0;
	if (version > DATABASE_VERSION) throw new NewerShortcutDatabaseError(version);
	if (version === DATABASE_VERSION) return;
	database.withTransactionSync(() =>
		database.execSync(`
		CREATE TABLE IF NOT EXISTS nutrition_food_shortcuts (
			subject TEXT NOT NULL, source_key TEXT NOT NULL, last_used_at INTEGER,
			portion_json TEXT, favorite INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY(subject, source_key)
		);
		CREATE INDEX IF NOT EXISTS nutrition_food_shortcuts_by_recent ON nutrition_food_shortcuts(subject, last_used_at DESC, source_key ASC);
		CREATE TABLE IF NOT EXISTS nutrition_food_meal_uses (
			subject TEXT NOT NULL, source_key TEXT NOT NULL, meal TEXT NOT NULL,
			last_used_at INTEGER NOT NULL, PRIMARY KEY(subject, source_key, meal)
		);
		DROP TABLE IF EXISTS nutrition_goal_preferences;
		DROP TABLE IF EXISTS nutrition_operations;
		DROP TABLE IF EXISTS nutrition_entry_mappings;
		DROP TABLE IF EXISTS nutrition_cached_days;
		DROP TABLE IF EXISTS nutrition_cached_goals;
		DROP TABLE IF EXISTS nutrition_cached_personal_measures;
		DROP TABLE IF EXISTS nutrition_cached_supplementary_servings;
		PRAGMA user_version = ${DATABASE_VERSION};
	`),
	);
}

const RECENT_LIMIT = 50;

export function createFoodShortcutRepository(
	database: SyncSQLiteDatabase,
	now: () => number = Date.now,
): FoodShortcutRepository {
	migrate(database);
	return {
		recordUse(subject, use, meal) {
			const timestamp = now();
			database.withTransactionSync(() => {
				database.runSync(
					`INSERT INTO nutrition_food_meal_uses(subject, source_key, meal, last_used_at)
					 VALUES (?, ?, ?, ?) ON CONFLICT(subject, source_key, meal) DO UPDATE SET
					 last_used_at = excluded.last_used_at`,
					subject,
					use.sourceKey,
					meal,
					timestamp,
				);
				database.runSync(
					`INSERT INTO nutrition_food_shortcuts(subject, source_key, last_used_at, portion_json, favorite)
					 VALUES (?, ?, ?, ?, 0) ON CONFLICT(subject, source_key) DO UPDATE SET
					 last_used_at = excluded.last_used_at, portion_json = excluded.portion_json`,
					subject,
					use.sourceKey,
					timestamp,
					JSON.stringify(use.portion),
				);
			});
		},
		listRecent(subject, meal) {
			return database
				.getAllSync<ShortcutRow>(
					`SELECT s.source_key, s.last_used_at, s.portion_json, s.favorite
					 FROM nutrition_food_shortcuts s
					 LEFT JOIN nutrition_food_meal_uses m
					 ON m.subject = s.subject AND m.source_key = s.source_key AND m.meal = ?
					 WHERE s.subject = ? AND s.last_used_at IS NOT NULL
					 ORDER BY m.last_used_at IS NULL, m.last_used_at DESC,
					 s.last_used_at DESC, s.source_key ASC LIMIT ?`,
					meal ?? "",
					subject,
					RECENT_LIMIT,
				)
				.map(rowToShortcut);
		},
		listFavorites(subject) {
			return database
				.getAllSync<ShortcutRow>(
					`SELECT source_key, last_used_at, portion_json, favorite
					 FROM nutrition_food_shortcuts
					 WHERE subject = ? AND favorite = 1
					 ORDER BY source_key ASC`,
					subject,
				)
				.map(rowToShortcut);
		},
		get(subject, sourceKey) {
			const row = database.getFirstSync<ShortcutRow>(
				"SELECT source_key, last_used_at, portion_json, favorite FROM nutrition_food_shortcuts WHERE subject = ? AND source_key = ?",
				subject,
				sourceKey,
			);
			return row ? rowToShortcut(row) : undefined;
		},
		setFavorite(subject, sourceKey, favorite) {
			database.runSync(
				`INSERT INTO nutrition_food_shortcuts(subject, source_key, favorite)
				 VALUES (?, ?, ?)
				 ON CONFLICT(subject, source_key) DO UPDATE SET favorite = excluded.favorite`,
				subject,
				sourceKey,
				favorite ? 1 : 0,
			);
		},
		clear(subject) {
			database.withTransactionSync(() => {
				database.runSync(
					"DELETE FROM nutrition_food_shortcuts WHERE subject = ?",
					subject,
				);
				database.runSync(
					"DELETE FROM nutrition_food_meal_uses WHERE subject = ?",
					subject,
				);
			});
		},
		close() {
			database.closeSync?.();
		},
	};
}

/**
 * Shortcuts are optional defaults, so a file from a newer build (an installed
 * build older than the last one) must not stop the app from opening: that file
 * stays untouched for the newer build and this session runs from memory.
 */
export function openFoodShortcutRepository(
	open: (name: string) => SyncSQLiteDatabase = openNutritionDatabase,
): FoodShortcutRepository {
	const database = open(FOOD_SHORTCUT_DATABASE_NAME);
	try {
		return createFoodShortcutRepository(database);
	} catch (error) {
		if (!(error instanceof NewerShortcutDatabaseError)) throw error;
		reportError(error, "nutrition.shortcuts.open");
		database.closeSync?.();
		return createFoodShortcutRepository(open(":memory:"));
	}
}

registerLocalDatabase(FOOD_SHORTCUT_DATABASE_NAME);
registerAccountStore({
	name: "nutrition-food-shortcuts",
	clear(subject) {
		const repository = openFoodShortcutRepository();
		try {
			repository.clear(subject);
		} finally {
			repository.close();
		}
	},
});
