import {
	canonicalJson,
	type NutritionDiaryOperation,
	type NutritionDiarySnapshot,
	type NutritionOperationEnvelope,
	rescaleNutrients,
	totalNutrients,
} from "@workouts/core";
import type { NutritionGoalValue } from "@workouts/core/nutrition";
import { openDatabaseSync } from "expo-sqlite";
import type { SyncSQLiteDatabase } from "./personal-food-repository";

export const NUTRITION_STATE_DATABASE_NAME = "workouts-nutrition-state.db";
const DATABASE_VERSION = 3;

export type CachedGoalHistory = {
	goals: NutritionGoalValue[];
	basis: "effective" | "reference";
	effectiveFrom: string | null;
};

export type LocalOperationStatus =
	| "queued"
	| "sending"
	| "acknowledged"
	| "needs-attention";

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

export type LocalProjectionHint = {
	readonly targetEntry?: NutritionServerEntry;
};

export type PortionMemory = {
	readonly kind: "authored" | "base-unit";
	readonly servingKey: string;
	readonly baseUnit: "g" | "ml";
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

export type NutritionLocalOperation = {
	readonly sequence: number;
	readonly subject: string;
	readonly operationId: string;
	readonly envelope: NutritionOperationEnvelope;
	readonly status: LocalOperationStatus;
	readonly attempts: number;
	readonly nextAttemptAt: number;
	readonly lastError?: string;
	readonly hint?: LocalProjectionHint;
	readonly createdAt: number;
};

export type NutritionProjectedEntry = NutritionServerEntry & {
	readonly pendingOperationId?: string;
};

export type NutritionProjectedDay = {
	readonly date: string;
	readonly revision: number;
	readonly complete: boolean;
	readonly entries: readonly NutritionProjectedEntry[];
	readonly totals: ReturnType<typeof totalNutrients>;
	readonly pendingOperationIds: readonly string[];
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
	getGoals(subject: string, date: string): CachedGoalHistory | undefined;
	putGoals(subject: string, date: string, history: CachedGoalHistory): void;
	accept(
		subject: string,
		envelope: NutritionOperationEnvelope,
		hint?: LocalProjectionHint,
		directFoodUse?: DirectFoodUse,
	): NutritionLocalOperation;
	listOperations(subject: string): NutritionLocalOperation[];
	getOperation(
		subject: string,
		operationId: string,
	): NutritionLocalOperation | undefined;
	markSending(subject: string, operationId: string): void;
	markQueued(subject: string, operationId: string, error?: string): void;
	markNeedsAttention(subject: string, operationId: string, error: string): void;
	recoverSending(subject: string): void;
	getDay(subject: string, date: string): NutritionCachedDay | undefined;
	putDay(subject: string, day: NutritionCachedDay): void;
	acknowledge(
		subject: string,
		operationId: string,
		result: NutritionOperationResult,
	): void;
	projectDay(subject: string, date: string): NutritionProjectedDay;
	listRecent(subject: string, limit?: number): FoodShortcut[];
	listFavorites(subject: string): FoodShortcut[];
	getShortcut(subject: string, sourceKey: string): FoodShortcut | undefined;
	toggleFavorite(subject: string, sourceKey: string, favorite: boolean): void;
	close(): void;
};

type OperationRow = {
	sequence: number;
	subject: string;
	operation_id: string;
	payload_json: string;
	status: LocalOperationStatus;
	attempts: number;
	next_attempt_at: number;
	last_error: string | null;
	hint_json: string | null;
	created_at: number;
};

type DayRow = {
	subject: string;
	date: string;
	revision: number;
	complete: number;
	entries_json: string;
	updated_at: number;
};

type ShortcutRow = {
	source_key: string;
	last_used_at: number | null;
	portion_json: string | null;
	favorite: number;
};

function migrate(database: SyncSQLiteDatabase): void {
	const current =
		database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
			?.user_version ?? 0;
	if (current > DATABASE_VERSION) {
		throw new Error(
			`This nutrition state database is newer than this version of Workouts (${current}).`,
		);
	}
	if (current === DATABASE_VERSION) return;
	database.execSync("BEGIN IMMEDIATE");
	try {
		if (current < 1) {
			database.execSync(`
				CREATE TABLE IF NOT EXISTS nutrition_operations (
					sequence INTEGER PRIMARY KEY AUTOINCREMENT,
					subject TEXT NOT NULL,
					operation_id TEXT NOT NULL,
					payload_json TEXT NOT NULL,
					status TEXT NOT NULL CHECK (status IN ('queued', 'sending', 'acknowledged', 'needs-attention')),
					attempts INTEGER NOT NULL DEFAULT 0,
					next_attempt_at INTEGER NOT NULL,
					last_error TEXT,
					hint_json TEXT,
					created_at INTEGER NOT NULL,
					UNIQUE(subject, operation_id)
				);
				CREATE INDEX IF NOT EXISTS nutrition_operations_by_subject_sequence
					ON nutrition_operations(subject, sequence ASC);
				CREATE TABLE IF NOT EXISTS nutrition_cached_days (
					subject TEXT NOT NULL,
					date TEXT NOT NULL,
					revision INTEGER NOT NULL,
					complete INTEGER NOT NULL,
					entries_json TEXT NOT NULL,
					updated_at INTEGER NOT NULL,
					PRIMARY KEY(subject, date)
				);
				CREATE TABLE IF NOT EXISTS nutrition_entry_mappings (
					subject TEXT NOT NULL,
					client_entry_id TEXT NOT NULL,
					server_entry_id TEXT NOT NULL,
					PRIMARY KEY(subject, client_entry_id)
				);
			`);
		}
		if (current < 2) {
			database.execSync(`
				CREATE TABLE IF NOT EXISTS nutrition_food_shortcuts (
					subject TEXT NOT NULL,
					source_key TEXT NOT NULL,
					last_used_at INTEGER,
					portion_json TEXT,
					favorite INTEGER NOT NULL DEFAULT 0,
					PRIMARY KEY(subject, source_key)
				);
				CREATE INDEX IF NOT EXISTS nutrition_food_shortcuts_by_recent
					ON nutrition_food_shortcuts(subject, last_used_at DESC, source_key ASC);
			`);
		}
		if (current < 3)
			database.execSync(
				"CREATE TABLE nutrition_cached_goals (subject TEXT NOT NULL, date TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(subject, date))",
			);
		database.execSync(`PRAGMA user_version = ${DATABASE_VERSION}`);
		database.execSync("COMMIT");
	} catch (error) {
		database.execSync("ROLLBACK");
		throw error;
	}
}

function transaction(database: SyncSQLiteDatabase, work: () => void): void {
	database.execSync("BEGIN IMMEDIATE");
	try {
		work();
		database.execSync("COMMIT");
	} catch (error) {
		database.execSync("ROLLBACK");
		throw error;
	}
}

function rowToOperation(row: OperationRow): NutritionLocalOperation {
	return {
		sequence: row.sequence,
		subject: row.subject,
		operationId: row.operation_id,
		envelope: JSON.parse(row.payload_json) as NutritionOperationEnvelope,
		status: row.status,
		attempts: row.attempts,
		nextAttemptAt: row.next_attempt_at,
		...(row.last_error ? { lastError: row.last_error } : {}),
		...(row.hint_json
			? { hint: JSON.parse(row.hint_json) as LocalProjectionHint }
			: {}),
		createdAt: row.created_at,
	};
}

function rowToDay(row: DayRow): NutritionCachedDay {
	return {
		subject: row.subject,
		date: row.date,
		revision: row.revision,
		complete: row.complete === 1,
		entries: JSON.parse(row.entries_json) as NutritionServerEntry[],
		updatedAt: row.updated_at,
	};
}

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

function entryForSnapshot(
	snapshot: NutritionDiarySnapshot,
	pendingOperationId?: string,
): NutritionProjectedEntry {
	return {
		_id: `client:${snapshot.clientEntryId ?? pendingOperationId ?? "local"}`,
		...snapshot,
		...(pendingOperationId ? { pendingOperationId } : {}),
	};
}

function entryMatches(
	entry: NutritionProjectedEntry,
	target:
		| { kind: "serverId"; id: string }
		| { kind: "clientEntryId"; id: string },
) {
	return target.kind === "serverId"
		? entry._id === target.id
		: entry.clientEntryId === target.id;
}

function applyUpdate(
	entries: NutritionProjectedEntry[],
	operation: Extract<NutritionDiaryOperation, { kind: "update" }>,
	operationId: string,
	hint?: LocalProjectionHint,
) {
	let entry = entries.find((candidate) =>
		entryMatches(candidate, operation.target),
	);
	if (!entry && hint?.targetEntry) {
		entry = entryForSnapshot(hint.targetEntry);
		entries.push(entry);
	}
	if (!entry) return;
	const oldQuantity = entry.quantity;
	const quantity = operation.quantity ?? oldQuantity;
	const factor = quantity / oldQuantity;
	const next = {
		...entry,
		...(operation.date ? { date: operation.date } : {}),
		...(operation.meal ? { meal: operation.meal } : {}),
		...(operation.quantity
			? {
					quantity,
					amount: entry.amount * factor,
					nutrients: rescaleNutrients(entry.nutrients, factor),
				}
			: {}),
		pendingOperationId: operationId,
	};
	const index = entries.indexOf(entry);
	entries[index] = next;
}

function applyOperations(
	base: NutritionCachedDay | undefined,
	date: string,
	operations: readonly NutritionLocalOperation[],
): NutritionProjectedDay {
	const entries = (base?.entries ?? []).map((entry) => ({ ...entry }));
	const pendingOperationIds: string[] = [];
	for (const local of operations) {
		if (local.status === "acknowledged") continue;
		const operation = local.envelope.operation;
		if (operation.kind === "create") {
			if (
				operation.entry.date === date &&
				!entries.some(
					(entry) => entry.clientEntryId === operation.entry.clientEntryId,
				)
			) {
				entries.push(entryForSnapshot(operation.entry, local.operationId));
			}
			pendingOperationIds.push(local.operationId);
		}
		if (operation.kind === "createBatch") {
			if (operation.date === date) {
				for (const entry of operation.entries) {
					if (
						!entries.some(
							(candidate) => candidate.clientEntryId === entry.clientEntryId,
						)
					) {
						entries.push(
							entryForSnapshot(
								{ ...entry, date: operation.date, meal: operation.meal },
								local.operationId,
							),
						);
					}
				}
			}
			pendingOperationIds.push(local.operationId);
		}
		if (operation.kind === "update") {
			applyUpdate(entries, operation, local.operationId, local.hint);
			pendingOperationIds.push(local.operationId);
		}
		if (operation.kind === "remove") {
			const index = entries.findIndex((entry) =>
				entryMatches(entry, operation.target),
			);
			if (index >= 0) entries.splice(index, 1);
			pendingOperationIds.push(local.operationId);
		}
	}
	const visible = entries.filter((entry) => entry.date === date);
	return {
		date,
		revision: base?.revision ?? 0,
		complete: base?.complete ?? false,
		entries: visible,
		totals: totalNutrients(visible.map((entry) => entry.nutrients)),
		pendingOperationIds: [...new Set(pendingOperationIds)],
	};
}

export function createNutritionLocalRepository(
	database: SyncSQLiteDatabase,
	now: () => number = Date.now,
): NutritionLocalRepository {
	migrate(database);
	return {
		accept(subject, envelope, hint, directFoodUse) {
			if (envelope.expectedSubject !== subject)
				throw new Error("Subject mismatch.");
			const timestamp = now();
			const payload = operationPayload(envelope);
			transaction(database, () => {
				database.runSync(
					`INSERT INTO nutrition_operations
					 (subject, operation_id, payload_json, status, attempts, next_attempt_at, hint_json, created_at)
					VALUES (?, ?, ?, 'queued', 0, 0, ?, ?)`,
					subject,
					envelope.operationId,
					payload,
					hint ? JSON.stringify(hint) : null,
					timestamp,
				);
				if (directFoodUse) {
					database.runSync(
						`INSERT INTO nutrition_food_shortcuts(subject, source_key, last_used_at, portion_json, favorite)
						 VALUES (?, ?, ?, ?, 0)
						 ON CONFLICT(subject, source_key) DO UPDATE SET
						 last_used_at = excluded.last_used_at,
						 portion_json = excluded.portion_json`,
						subject,
						directFoodUse.sourceKey,
						timestamp,
						JSON.stringify(directFoodUse.portion),
					);
				}
			});
			const created = this.getOperation(subject, envelope.operationId);
			if (!created) throw new Error("Local nutrition operation was not saved.");
			return created;
		},
		listOperations(subject) {
			return database
				.getAllSync<OperationRow>(
					"SELECT * FROM nutrition_operations WHERE subject = ? ORDER BY sequence ASC",
					subject,
				)
				.map(rowToOperation);
		},
		getOperation(subject, operationId) {
			const row = database.getFirstSync<OperationRow>(
				"SELECT * FROM nutrition_operations WHERE subject = ? AND operation_id = ?",
				subject,
				operationId,
			);
			return row ? rowToOperation(row) : undefined;
		},
		markSending(subject, operationId) {
			database.runSync(
				"UPDATE nutrition_operations SET status = 'sending', attempts = attempts + 1 WHERE subject = ? AND operation_id = ?",
				subject,
				operationId,
			);
		},
		markQueued(subject, operationId, error) {
			const operation = this.getOperation(subject, operationId);
			const attempts = operation?.attempts ?? 0;
			const delay = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6));
			database.runSync(
				"UPDATE nutrition_operations SET status = 'queued', next_attempt_at = ?, last_error = ? WHERE subject = ? AND operation_id = ?",
				now() + delay,
				error ?? null,
				subject,
				operationId,
			);
		},
		markNeedsAttention(subject, operationId, error) {
			database.runSync(
				"UPDATE nutrition_operations SET status = 'needs-attention', last_error = ? WHERE subject = ? AND operation_id = ?",
				error,
				subject,
				operationId,
			);
		},
		recoverSending(subject) {
			database.runSync(
				"UPDATE nutrition_operations SET status = 'queued' WHERE subject = ? AND status = 'sending'",
				subject,
			);
		},
		getDay(subject, date) {
			const row = database.getFirstSync<DayRow>(
				"SELECT * FROM nutrition_cached_days WHERE subject = ? AND date = ?",
				subject,
				date,
			);
			return row ? rowToDay(row) : undefined;
		},
		putDay(subject, day) {
			const current = this.getDay(subject, day.date);
			if (current && current.revision > day.revision) return;
			database.runSync(
				`INSERT INTO nutrition_cached_days(subject, date, revision, complete, entries_json, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?)
				 ON CONFLICT(subject, date) DO UPDATE SET
				 revision = excluded.revision,
				 complete = excluded.complete,
				 entries_json = excluded.entries_json,
				 updated_at = excluded.updated_at`,
				subject,
				day.date,
				day.revision,
				day.complete ? 1 : 0,
				JSON.stringify(day.entries),
				day.updatedAt,
			);
		},
		acknowledge(subject, operationId, result) {
			transaction(database, () => {
				for (const day of result.days) {
					this.putDay(subject, {
						subject,
						date: day.date,
						revision: day.revision,
						complete: true,
						entries: day.entries,
						updatedAt: now(),
					});
				}
				for (let index = 0; index < result.clientEntryIds.length; index += 1) {
					const clientEntryId = result.clientEntryIds[index];
					const serverEntryId = result.entryIds[index];
					if (!clientEntryId || !serverEntryId) continue;
					database.runSync(
						`INSERT INTO nutrition_entry_mappings(subject, client_entry_id, server_entry_id)
						 VALUES (?, ?, ?)
						 ON CONFLICT(subject, client_entry_id) DO UPDATE SET server_entry_id = excluded.server_entry_id`,
						subject,
						clientEntryId,
						serverEntryId,
					);
				}
				database.runSync(
					"UPDATE nutrition_operations SET status = 'acknowledged', last_error = NULL WHERE subject = ? AND operation_id = ?",
					subject,
					operationId,
				);
			});
		},
		projectDay(subject, date) {
			return applyOperations(
				this.getDay(subject, date),
				date,
				this.listOperations(subject),
			);
		},
		getGoals(subject, date) {
			const row = database.getFirstSync<{ payload: string }>(
				"SELECT payload FROM nutrition_cached_goals WHERE subject = ? AND date = ?",
				subject,
				date,
			);
			return row ? (JSON.parse(row.payload) as CachedGoalHistory) : undefined;
		},
		putGoals(subject, date, history) {
			database.runSync(
				"INSERT INTO nutrition_cached_goals(subject, date, payload) VALUES (?, ?, ?) ON CONFLICT(subject, date) DO UPDATE SET payload = excluded.payload",
				subject,
				date,
				JSON.stringify(history),
			);
		},
		listRecent(subject, limit = 50) {
			return database
				.getAllSync<ShortcutRow>(
					`SELECT source_key, last_used_at, portion_json, favorite
					 FROM nutrition_food_shortcuts
					 WHERE subject = ? AND last_used_at IS NOT NULL
					 ORDER BY last_used_at DESC, source_key ASC LIMIT ?`,
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
		openDatabaseSync(
			NUTRITION_STATE_DATABASE_NAME,
		) as unknown as SyncSQLiteDatabase,
	);
}

export function operationPayload(envelope: NutritionOperationEnvelope): string {
	return canonicalJson(envelope);
}
