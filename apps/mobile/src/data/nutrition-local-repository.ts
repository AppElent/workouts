import {
	canonicalJson,
	type NutritionDiarySnapshot,
	type NutritionOperationEnvelope,
	totalNutrients,
} from "@foundry/core";
import type {
	NutrientKey,
	NutritionGoalValue,
	PersonalMeasure,
	SupplementaryServing,
} from "@foundry/core/nutrition";
import { openNutritionDatabase } from "./nutrition-database";
import type { SyncSQLiteDatabase } from "./personal-food-repository";

export const NUTRITION_STATE_DATABASE_NAME = "workouts-nutrition-state.db";
const DATABASE_VERSION = 8;

export type CachedGoalHistory = {
	goals: NutritionGoalValue[];
	basis: "effective" | "reference";
	effectiveFrom: string | null;
	displayOrder?: NutrientKey[];
};

export type NutritionServerEntry = NutritionDiarySnapshot & {
	readonly _id: string;
	readonly _creationTime?: number;
	readonly comboGroup?: {
		readonly id: string;
		readonly comboId: string;
		readonly name: string;
	};
};

export type NutritionCachedDay = {
	readonly subject: string;
	readonly date: string;
	readonly revision: number;
	readonly complete: boolean;
	readonly entries: readonly NutritionServerEntry[];
	readonly updatedAt: number;
};

export type PortionMemory = {
	readonly kind:
		| "authored"
		| "base-unit"
		| "personal-measure"
		| "supplementary";
	readonly servingKey: string;
	readonly baseUnit: "g" | "ml" | "serving";
	readonly amount: number;
	readonly quantity: number;
	readonly label: { readonly en: string; readonly nl: string };
};

export type DirectFoodUse = {
	readonly sourceKey: string;
	readonly portion: PortionMemory;
};

export type FoodShortcut = {
	readonly sourceKey: string;
	readonly lastUsedAt?: number;
	readonly portion?: PortionMemory;
	readonly favorite: boolean;
};

/** A diary write the server acknowledged during this session. */
export type AcknowledgedOperation = {
	readonly subject: string;
	readonly operationId: string;
	readonly envelope: NutritionOperationEnvelope;
	readonly createdAt: number;
};

/** The newest server snapshot of a day seen in this session. */
export type NutritionSessionDay = {
	readonly date: string;
	readonly revision: number;
	readonly complete: boolean;
	readonly entries: readonly NutritionServerEntry[];
	readonly totals: ReturnType<typeof totalNutrients>;
};

export type NutritionServerDayResult = {
	readonly date: string;
	readonly revision: number;
	readonly entries: readonly NutritionServerEntry[];
	readonly totals: unknown;
};

export type NutritionOperationResult = {
	readonly entryIds: readonly string[];
	readonly clientEntryIds: readonly string[];
	readonly days: readonly NutritionServerDayResult[];
};

export type NutritionLocalRepository = {
	getSupplementaryServings(
		subject: string,
		foodId: string,
	): SupplementaryServing[];
	putSupplementaryServings(
		subject: string,
		foodId: string,
		servings: readonly SupplementaryServing[],
	): void;
	getGoals(subject: string, date: string): CachedGoalHistory | undefined;
	putGoals(subject: string, date: string, history: CachedGoalHistory): void;
	getPersonalMeasures(subject: string): PersonalMeasure[];
	putPersonalMeasures(
		subject: string,
		measures: readonly PersonalMeasure[],
	): void;
	getGoalDisplayOrder(subject: string): NutrientKey[] | undefined;
	putGoalDisplayOrder(subject: string, displayOrder: NutrientKey[]): void;
	recordAcknowledged(
		subject: string,
		envelope: NutritionOperationEnvelope,
		result: NutritionOperationResult,
		directFoodUse?: DirectFoodUse,
	): void;
	listOperations(subject: string): AcknowledgedOperation[];
	getDay(subject: string, date: string): NutritionCachedDay | undefined;
	putDay(subject: string, day: NutritionCachedDay): void;
	projectDay(subject: string, date: string): NutritionSessionDay;
	/** Newest first; with a meal, what was logged to that meal leads. */
	listRecent(subject: string, limit?: number, meal?: string): FoodShortcut[];
	listFavorites(subject: string): FoodShortcut[];
	getShortcut(subject: string, sourceKey: string): FoodShortcut | undefined;
	toggleFavorite(subject: string, sourceKey: string, favorite: boolean): void;
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

function migrate(database: SyncSQLiteDatabase) {
	const version =
		database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
			?.user_version ?? 0;
	if (version > DATABASE_VERSION)
		throw new Error("This nutrition state database is newer than this app.");
	if (version === DATABASE_VERSION) return;
	database.execSync("BEGIN IMMEDIATE");
	try {
		const journal = database.getFirstSync(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'nutrition_operations'",
		);
		if (
			journal &&
			database.getFirstSync(
				"SELECT 1 FROM nutrition_operations WHERE status != 'acknowledged' LIMIT 1",
			)
		)
			throw new Error(
				"Upload legacy diary changes with build 20 before updating this app.",
			);
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
			CREATE TABLE IF NOT EXISTS nutrition_goal_preferences (subject TEXT PRIMARY KEY, display_order_json TEXT NOT NULL);
			DROP TABLE IF EXISTS nutrition_operations;
			DROP TABLE IF EXISTS nutrition_entry_mappings;
			DROP TABLE IF EXISTS nutrition_cached_days;
			DROP TABLE IF EXISTS nutrition_cached_goals;
			DROP TABLE IF EXISTS nutrition_cached_personal_measures;
			DROP TABLE IF EXISTS nutrition_cached_supplementary_servings;
			PRAGMA user_version = 8;
		`);
		database.execSync("COMMIT");
	} catch (error) {
		database.execSync("ROLLBACK");
		throw error;
	}
}

/** Server snapshots are bounded session memory; only optional defaults use SQLite. */
export function createNutritionLocalRepository(
	database: SyncSQLiteDatabase,
	now: () => number = Date.now,
): NutritionLocalRepository {
	migrate(database);
	const days = new Map<string, NutritionCachedDay>();
	const goals = new Map<string, CachedGoalHistory>();
	const measures = new Map<string, PersonalMeasure[]>();
	const servings = new Map<string, SupplementaryServing[]>();
	const acknowledged = new Map<string, AcknowledgedOperation>();
	const key = (subject: string, id: string) => canonicalJson([subject, id]);
	function retain<T>(cache: Map<string, T>, id: string, value: T) {
		cache.delete(id);
		cache.set(id, value);
		const oldest = cache.keys().next().value;
		if (cache.size > 32 && oldest !== undefined) cache.delete(oldest);
	}
	return {
		recordAcknowledged(subject, envelope, result, directFoodUse) {
			if (envelope.expectedSubject !== subject)
				throw new Error("Subject mismatch.");
			const timestamp = now();
			acknowledged.set(key(subject, envelope.operationId), {
				subject,
				operationId: envelope.operationId,
				envelope,
				createdAt: timestamp,
			});
			for (const day of result.days)
				this.putDay(subject, {
					subject,
					date: day.date,
					revision: day.revision,
					complete: true,
					entries: day.entries,
					updatedAt: timestamp,
				});
			// Optional defaults must never turn an acknowledged server save into a failed save.
			try {
				const meal =
					envelope.operation.kind === "create"
						? envelope.operation.entry.meal
						: envelope.operation.kind === "createBatch"
							? envelope.operation.meal
							: undefined;
				if (directFoodUse && meal)
					database.runSync(
						`INSERT INTO nutrition_food_meal_uses(subject, source_key, meal, last_used_at)
						 VALUES (?, ?, ?, ?) ON CONFLICT(subject, source_key, meal) DO UPDATE SET
						 last_used_at = excluded.last_used_at`,
						subject,
						directFoodUse.sourceKey,
						meal,
						timestamp,
					);
				if (directFoodUse)
					database.runSync(
						`
				INSERT INTO nutrition_food_shortcuts(subject, source_key, last_used_at, portion_json, favorite)
				VALUES (?, ?, ?, ?, 0) ON CONFLICT(subject, source_key) DO UPDATE SET
				last_used_at = excluded.last_used_at, portion_json = excluded.portion_json`,
						subject,
						directFoodUse.sourceKey,
						timestamp,
						JSON.stringify(directFoodUse.portion),
					);
			} catch {
				/* The server snapshot and receipt above remain authoritative. */
			}
		},
		listOperations(subject) {
			return [...acknowledged.values()].filter(
				(operation) => operation.subject === subject,
			);
		},
		getDay(subject, date) {
			return days.get(key(subject, date));
		},
		putDay(subject, day) {
			const id = key(subject, day.date);
			if ((days.get(id)?.revision ?? -1) <= day.revision) retain(days, id, day);
		},
		projectDay(subject, date) {
			const day = this.getDay(subject, date);
			const entries = day?.entries ?? [];
			return {
				date,
				revision: day?.revision ?? 0,
				complete: day?.complete ?? false,
				entries,
				totals: totalNutrients(entries.map((entry) => entry.nutrients)),
			};
		},
		getGoals(subject, date) {
			const history = goals.get(key(subject, date));
			if (!history) return undefined;
			const displayOrder = this.getGoalDisplayOrder(subject);
			return displayOrder ? { ...history, displayOrder } : history;
		},
		putGoals(subject, date, history) {
			retain(goals, key(subject, date), history);
			if (history.displayOrder)
				this.putGoalDisplayOrder(subject, history.displayOrder);
		},
		getSupplementaryServings(subject, foodId) {
			return servings.get(key(subject, foodId)) ?? [];
		},
		putSupplementaryServings(subject, foodId, values) {
			retain(servings, key(subject, foodId), [...values]);
		},
		getPersonalMeasures(subject) {
			return measures.get(subject) ?? [];
		},
		putPersonalMeasures(subject, values) {
			retain(measures, subject, [...values]);
		},
		getGoalDisplayOrder(subject) {
			const row = database.getFirstSync<{ display_order_json: string }>(
				"SELECT display_order_json FROM nutrition_goal_preferences WHERE subject = ?",
				subject,
			);
			return row
				? (JSON.parse(row.display_order_json) as NutrientKey[])
				: undefined;
		},
		putGoalDisplayOrder(subject, displayOrder) {
			database.runSync(
				"INSERT INTO nutrition_goal_preferences(subject, display_order_json) VALUES (?, ?) ON CONFLICT(subject) DO UPDATE SET display_order_json = excluded.display_order_json",
				subject,
				JSON.stringify(displayOrder),
			);
		},
		listRecent(subject, limit = 50, meal) {
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
					Math.min(50, Math.max(1, limit)),
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
		getShortcut(subject, sourceKey) {
			const row = database.getFirstSync<ShortcutRow>(
				"SELECT source_key, last_used_at, portion_json, favorite FROM nutrition_food_shortcuts WHERE subject = ? AND source_key = ?",
				subject,
				sourceKey,
			);
			return row ? rowToShortcut(row) : undefined;
		},
		toggleFavorite(subject, sourceKey, favorite) {
			database.runSync(
				`INSERT INTO nutrition_food_shortcuts(subject, source_key, favorite)
				 VALUES (?, ?, ?)
				 ON CONFLICT(subject, source_key) DO UPDATE SET favorite = excluded.favorite`,
				subject,
				sourceKey,
				favorite ? 1 : 0,
			);
		},
		close() {
			const closable = database as SyncSQLiteDatabase & {
				closeSync?: () => void;
			};
			closable.closeSync?.();
		},
	};
}

export function openNutritionLocalRepository(): NutritionLocalRepository {
	return createNutritionLocalRepository(
		openNutritionDatabase(NUTRITION_STATE_DATABASE_NAME),
	);
}

/** Confirmed test-data resets remove the account's optional defaults. */
export function clearNutritionLocalAccount(subject: string) {
	const database = openNutritionDatabase(NUTRITION_STATE_DATABASE_NAME);
	try {
		createNutritionLocalRepository(database);
		database.withTransactionSync(() => {
			database.runSync(
				"DELETE FROM nutrition_food_shortcuts WHERE subject = ?",
				subject,
			);
			database.runSync(
				"DELETE FROM nutrition_food_meal_uses WHERE subject = ?",
				subject,
			);
			database.runSync(
				"DELETE FROM nutrition_goal_preferences WHERE subject = ?",
				subject,
			);
		});
	} finally {
		database.closeSync();
	}
}
