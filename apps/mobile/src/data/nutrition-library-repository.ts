import { openDatabaseSync } from "expo-sqlite";
import type {
	Combo,
	PersonalFood,
	PersonalFoodRepository,
	SyncSQLiteDatabase,
} from "./personal-food-repository";

export const NUTRITION_LIBRARY_STATE_DATABASE_NAME =
	"workouts-nutrition-library-state.db";
const DATABASE_VERSION = 2;

export type LibraryRecordKind = "food" | "combo";
export type LibraryRecord = {
	readonly id: string;
	readonly kind: LibraryRecordKind;
	readonly payload: string | null;
	readonly revision: number;
	readonly deleted: boolean;
};

export type LibraryOperation = {
	readonly sequence: number;
	readonly operationId: string;
	readonly kind: "upsert" | "remove";
	readonly recordId: string;
	readonly recordKind: LibraryRecordKind;
	readonly payload: string | null;
	readonly expectedRevision: number;
	readonly status: "queued" | "sending" | "needs-attention";
	readonly attempts: number;
	readonly lastError?: string;
};

export type LibraryConflict = {
	readonly record: LibraryRecord;
	readonly localPayload: string | null;
	readonly serverPayload: string | null;
	readonly serverRevision: number;
	readonly serverDeleted: boolean;
};

export type PreparedLibraryMutation = {
	readonly transactionId: string;
	readonly action: "upsert" | "remove";
	readonly recordId: string;
	readonly recordKind: LibraryRecordKind;
};

type Row = {
	record_id: string;
	record_kind: LibraryRecordKind;
	payload_json: string | null;
	revision: number;
	deleted: number;
};

type OperationRow = {
	sequence: number;
	operation_id: string;
	kind: "upsert" | "remove";
	record_id: string;
	record_kind: LibraryRecordKind;
	payload_json: string | null;
	expected_revision: number;
	status: "queued" | "sending" | "needs-attention";
	attempts: number;
	last_error: string | null;
};

type ConflictRow = Row & {
	local_payload_json: string | null;
	server_payload_json: string | null;
	server_revision: number;
	server_deleted: number;
};

function migrate(database: SyncSQLiteDatabase) {
	const version =
		database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
			?.user_version ?? 0;
	if (version > DATABASE_VERSION) {
		throw new Error("This nutrition library state is newer than this app.");
	}
	if (version === DATABASE_VERSION) return;
	database.execSync("BEGIN IMMEDIATE");
	try {
		database.execSync(`
			CREATE TABLE IF NOT EXISTS nutrition_library_settings (
				subject TEXT PRIMARY KEY NOT NULL,
				enabled INTEGER NOT NULL CHECK (enabled IN (0, 1))
			);
			CREATE TABLE IF NOT EXISTS nutrition_library_records (
				subject TEXT NOT NULL,
				record_id TEXT NOT NULL,
				record_kind TEXT NOT NULL CHECK (record_kind IN ('food', 'combo')),
				payload_json TEXT,
				revision INTEGER NOT NULL,
				deleted INTEGER NOT NULL CHECK (deleted IN (0, 1)),
				PRIMARY KEY(subject, record_id)
			);
			CREATE TABLE IF NOT EXISTS nutrition_library_operations (
				sequence INTEGER PRIMARY KEY AUTOINCREMENT,
				subject TEXT NOT NULL,
				operation_id TEXT NOT NULL,
				kind TEXT NOT NULL CHECK (kind IN ('upsert', 'remove')),
				record_id TEXT NOT NULL,
				record_kind TEXT NOT NULL CHECK (record_kind IN ('food', 'combo')),
				payload_json TEXT,
				expected_revision INTEGER NOT NULL,
				status TEXT NOT NULL CHECK (status IN ('queued', 'sending', 'needs-attention')),
				attempts INTEGER NOT NULL DEFAULT 0,
				last_error TEXT,
				UNIQUE(subject, operation_id)
			);
			CREATE INDEX IF NOT EXISTS nutrition_library_operations_by_subject_sequence
				ON nutrition_library_operations(subject, sequence ASC);
			CREATE TABLE IF NOT EXISTS nutrition_library_prepared (
				subject TEXT NOT NULL,
				transaction_id TEXT NOT NULL,
				action TEXT NOT NULL CHECK (action IN ('upsert', 'remove')),
				record_id TEXT NOT NULL,
				record_kind TEXT NOT NULL CHECK (record_kind IN ('food', 'combo')),
				PRIMARY KEY(subject, transaction_id)
			);
			CREATE TABLE IF NOT EXISTS nutrition_library_conflicts (
				subject TEXT NOT NULL,
				record_id TEXT NOT NULL,
				record_kind TEXT NOT NULL CHECK (record_kind IN ('food', 'combo')),
				local_payload_json TEXT,
				server_payload_json TEXT,
				server_revision INTEGER NOT NULL,
				server_deleted INTEGER NOT NULL CHECK (server_deleted IN (0, 1)),
				PRIMARY KEY(subject, record_id)
			);
		`);
		if (version < 2) {
			database.execSync(`
				CREATE TABLE IF NOT EXISTS nutrition_library_legacy_claim (
					claim_key TEXT PRIMARY KEY NOT NULL,
					subject TEXT NOT NULL
				);
			`);
		}
		database.execSync(`PRAGMA user_version = ${DATABASE_VERSION};`);
		database.execSync("COMMIT");
	} catch (error) {
		database.execSync("ROLLBACK");
		throw error;
	}
}

function recordFromRow(row: Row): LibraryRecord {
	return {
		id: row.record_id,
		kind: row.record_kind,
		payload: row.payload_json,
		revision: row.revision,
		deleted: row.deleted === 1,
	};
}

function operationFromRow(row: OperationRow): LibraryOperation {
	return {
		sequence: row.sequence,
		operationId: row.operation_id,
		kind: row.kind,
		recordId: row.record_id,
		recordKind: row.record_kind,
		payload: row.payload_json,
		expectedRevision: row.expected_revision,
		status: row.status,
		attempts: row.attempts,
		...(row.last_error ? { lastError: row.last_error } : {}),
	};
}

export type NutritionLibraryStateRepository = {
	isEnabled(subject: string): boolean;
	setEnabled(subject: string, enabled: boolean): void;
	legacyClaimedBy(): string | undefined;
	claimLegacy(subject: string): boolean;
	getRecord(subject: string, id: string): LibraryRecord | undefined;
	listRecords(subject: string): LibraryRecord[];
	listOperations(subject: string): LibraryOperation[];
	queueUpsert(
		subject: string,
		record: LibraryRecord,
		operationId: string,
	): void;
	queueRemove(
		subject: string,
		record: LibraryRecord,
		operationId: string,
	): void;
	prepare(subject: string, mutation: PreparedLibraryMutation): void;
	listPrepared(subject: string): PreparedLibraryMutation[];
	commitPrepared(
		subject: string,
		transactionId: string,
		record: LibraryRecord,
	): void;
	discardPrepared(subject: string, transactionId: string): void;
	markSending(
		subject: string,
		operationId: string,
	): LibraryOperation | undefined;
	/** Requeue interrupted sends without changing their original expected revision. */
	recoverSending(subject: string): void;
	acknowledge(
		subject: string,
		operationId: string,
		record: LibraryRecord,
	): void;
	markQueued(subject: string, operationId: string, error: string): void;
	markNeedsAttention(subject: string, operationId: string, error: string): void;
	/** Classifies an incoming record without advancing metadata before its food DB write succeeds. */
	acceptServerRecord(
		subject: string,
		record: LibraryRecord,
	): "apply" | "conflict" | "ignore";
	commitServerRecord(subject: string, record: LibraryRecord): void;
	listConflicts(subject: string): LibraryConflict[];
	clearConflict(subject: string, recordId: string): void;
	adoptServerConflict(subject: string, record: LibraryRecord): void;
	clearOperationsForRecord(subject: string, recordId: string): void;
	resolveLocalConflict(
		subject: string,
		record: LibraryRecord,
		serverRevision: number,
		operationId: string,
	): void;
};

/** Durable metadata/outbox only; food payloads live in the per-account library DB. */
export function createNutritionLibraryStateRepository(
	database: SyncSQLiteDatabase,
): NutritionLibraryStateRepository {
	migrate(database);
	const saveRecord = (subject: string, record: LibraryRecord) => {
		database.runSync(
			`INSERT INTO nutrition_library_records(subject, record_id, record_kind, payload_json, revision, deleted)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(subject, record_id) DO UPDATE SET
			 record_kind = excluded.record_kind, payload_json = excluded.payload_json,
			 revision = excluded.revision, deleted = excluded.deleted`,
			subject,
			record.id,
			record.kind,
			record.payload,
			record.revision,
			record.deleted ? 1 : 0,
		);
	};
	const getRecord = (subject: string, id: string) => {
		const row = database.getFirstSync<Row>(
			"SELECT * FROM nutrition_library_records WHERE subject = ? AND record_id = ?",
			subject,
			id,
		);
		return row ? recordFromRow(row) : undefined;
	};
	return {
		isEnabled(subject) {
			return (
				(database.getFirstSync<{ enabled: number }>(
					"SELECT enabled FROM nutrition_library_settings WHERE subject = ?",
					subject,
				)?.enabled ?? 0) === 1
			);
		},
		setEnabled(subject, enabled) {
			database.runSync(
				`INSERT INTO nutrition_library_settings(subject, enabled) VALUES (?, ?)
				 ON CONFLICT(subject) DO UPDATE SET enabled = excluded.enabled`,
				subject,
				enabled ? 1 : 0,
			);
		},
		legacyClaimedBy() {
			return database.getFirstSync<{ subject: string }>(
				"SELECT subject FROM nutrition_library_legacy_claim WHERE claim_key = 'personal-library-v1'",
			)?.subject;
		},
		claimLegacy(subject) {
			const owner = this.legacyClaimedBy();
			if (owner && owner !== subject) return false;
			if (!owner) {
				database.runSync(
					"INSERT INTO nutrition_library_legacy_claim(claim_key, subject) VALUES ('personal-library-v1', ?)",
					subject,
				);
			}
			return true;
		},
		getRecord,
		listRecords(subject) {
			return database
				.getAllSync<Row>(
					"SELECT * FROM nutrition_library_records WHERE subject = ? ORDER BY record_id ASC",
					subject,
				)
				.map(recordFromRow);
		},
		listOperations(subject) {
			return database
				.getAllSync<OperationRow>(
					"SELECT * FROM nutrition_library_operations WHERE subject = ? ORDER BY sequence ASC",
					subject,
				)
				.map(operationFromRow);
		},
		queueUpsert(subject, record, operationId) {
			saveRecord(subject, { ...record, deleted: false });
			const replaceable = database.getFirstSync<OperationRow>(
				`SELECT * FROM nutrition_library_operations
				 WHERE subject = ? AND record_id = ? AND status = 'queued' AND attempts = 0
				 ORDER BY sequence DESC LIMIT 1`,
				subject,
				record.id,
			);
			if (replaceable) {
				database.runSync(
					"UPDATE nutrition_library_operations SET kind = 'upsert', payload_json = ?, record_kind = ? WHERE sequence = ?",
					record.payload,
					record.kind,
					replaceable.sequence,
				);
				return;
			}
			database.runSync(
				`INSERT INTO nutrition_library_operations(subject, operation_id, kind, record_id, record_kind, payload_json, expected_revision, status, attempts)
				 VALUES (?, ?, 'upsert', ?, ?, ?, ?, 'queued', 0)`,
				subject,
				operationId,
				record.id,
				record.kind,
				record.payload,
				record.revision,
			);
		},
		queueRemove(subject, record, operationId) {
			saveRecord(subject, { ...record, payload: null, deleted: true });
			database.runSync(
				`INSERT INTO nutrition_library_operations(subject, operation_id, kind, record_id, record_kind, payload_json, expected_revision, status, attempts)
				 VALUES (?, ?, 'remove', ?, ?, NULL, ?, 'queued', 0)`,
				subject,
				operationId,
				record.id,
				record.kind,
				record.revision,
			);
		},
		prepare(subject, mutation) {
			database.runSync(
				`INSERT INTO nutrition_library_prepared(subject, transaction_id, action, record_id, record_kind)
				 VALUES (?, ?, ?, ?, ?)`,
				subject,
				mutation.transactionId,
				mutation.action,
				mutation.recordId,
				mutation.recordKind,
			);
		},
		listPrepared(subject) {
			return database
				.getAllSync<{
					transaction_id: string;
					action: "upsert" | "remove";
					record_id: string;
					record_kind: LibraryRecordKind;
				}>(
					"SELECT * FROM nutrition_library_prepared WHERE subject = ? ORDER BY transaction_id ASC",
					subject,
				)
				.map((row) => ({
					transactionId: row.transaction_id,
					action: row.action,
					recordId: row.record_id,
					recordKind: row.record_kind,
				}));
		},
		commitPrepared(subject, transactionId, record) {
			const prepared = database.getFirstSync<{
				action: "upsert" | "remove";
				record_id: string;
				record_kind: LibraryRecordKind;
			}>(
				"SELECT action, record_id, record_kind FROM nutrition_library_prepared WHERE subject = ? AND transaction_id = ?",
				subject,
				transactionId,
			);
			if (!prepared) throw new Error("Library write preparation is missing.");
			database.execSync("BEGIN IMMEDIATE");
			try {
				if (prepared.action === "upsert")
					this.queueUpsert(subject, record, transactionId);
				else this.queueRemove(subject, record, transactionId);
				database.runSync(
					"DELETE FROM nutrition_library_prepared WHERE subject = ? AND transaction_id = ?",
					subject,
					transactionId,
				);
				database.execSync("COMMIT");
			} catch (error) {
				database.execSync("ROLLBACK");
				throw error;
			}
		},
		discardPrepared(subject, transactionId) {
			database.runSync(
				"DELETE FROM nutrition_library_prepared WHERE subject = ? AND transaction_id = ?",
				subject,
				transactionId,
			);
		},
		markSending(subject, operationId) {
			const operation = database.getFirstSync<OperationRow>(
				"SELECT * FROM nutrition_library_operations WHERE subject = ? AND operation_id = ?",
				subject,
				operationId,
			);
			if (operation?.status !== "queued") return undefined;
			const record = getRecord(subject, operation.record_id);
			if (!record) return undefined;
			const expectedRevision =
				operation.attempts === 0
					? record.revision
					: operation.expected_revision;
			database.runSync(
				"UPDATE nutrition_library_operations SET expected_revision = ?, status = 'sending', attempts = attempts + 1, last_error = NULL WHERE sequence = ?",
				expectedRevision,
				operation.sequence,
			);
			return {
				...operationFromRow(operation),
				expectedRevision,
				attempts: operation.attempts + 1,
				status: "sending",
			};
		},
		recoverSending(subject) {
			database.runSync(
				`UPDATE nutrition_library_operations
				 SET status = 'queued', last_error = COALESCE(last_error, 'Sync interrupted')
				 WHERE subject = ? AND status = 'sending'`,
				subject,
			);
		},
		acknowledge(subject, operationId, record) {
			const acknowledged = database.getFirstSync<OperationRow>(
				"SELECT * FROM nutrition_library_operations WHERE subject = ? AND operation_id = ?",
				subject,
				operationId,
			);
			if (!acknowledged) return;
			const hasLaterWork =
				(database.getFirstSync<{ count: number }>(
					`SELECT COUNT(*) AS count FROM nutrition_library_operations
				 WHERE subject = ? AND record_id = ? AND sequence > ?`,
					subject,
					record.id,
					acknowledged.sequence,
				)?.count ?? 0) > 0;
			const latestLocal = getRecord(subject, record.id);
			database.execSync("BEGIN IMMEDIATE");
			try {
				// A later local edit (including a deletion) already changed the account
				// library. Keep that payload authoritative while rebasing it on this ACK.
				if (hasLaterWork && latestLocal) {
					saveRecord(subject, { ...latestLocal, revision: record.revision });
				} else {
					saveRecord(subject, record);
					this.clearConflict(subject, record.id);
				}
				database.runSync(
					"DELETE FROM nutrition_library_operations WHERE subject = ? AND operation_id = ?",
					subject,
					operationId,
				);
				database.runSync(
					"UPDATE nutrition_library_operations SET expected_revision = ? WHERE subject = ? AND record_id = ? AND status = 'queued' AND attempts = 0",
					record.revision,
					subject,
					record.id,
				);
				database.execSync("COMMIT");
			} catch (error) {
				database.execSync("ROLLBACK");
				throw error;
			}
		},
		markQueued(subject, operationId, error) {
			database.runSync(
				"UPDATE nutrition_library_operations SET status = 'queued', last_error = ? WHERE subject = ? AND operation_id = ?",
				error,
				subject,
				operationId,
			);
		},
		markNeedsAttention(subject, operationId, error) {
			database.runSync(
				"UPDATE nutrition_library_operations SET status = 'needs-attention', last_error = ? WHERE subject = ? AND operation_id = ?",
				error,
				subject,
				operationId,
			);
		},
		acceptServerRecord(subject, record) {
			const local = getRecord(subject, record.id);
			if (local && local.revision >= record.revision) return "ignore";
			const dirty =
				database.getFirstSync<{ count: number }>(
					"SELECT COUNT(*) AS count FROM nutrition_library_operations WHERE subject = ? AND record_id = ?",
					subject,
					record.id,
				)?.count ?? 0;
			if (dirty > 0) {
				database.runSync(
					`INSERT INTO nutrition_library_conflicts(subject, record_id, record_kind, local_payload_json, server_payload_json, server_revision, server_deleted)
					 VALUES (?, ?, ?, ?, ?, ?, ?)
					 ON CONFLICT(subject, record_id) DO UPDATE SET
					 local_payload_json = excluded.local_payload_json, server_payload_json = excluded.server_payload_json,
					 server_revision = excluded.server_revision, server_deleted = excluded.server_deleted`,
					subject,
					record.id,
					record.kind,
					local?.payload ?? null,
					record.payload,
					record.revision,
					record.deleted ? 1 : 0,
				);
				return "conflict";
			}
			return "apply";
		},
		commitServerRecord(subject, record) {
			database.execSync("BEGIN IMMEDIATE");
			try {
				saveRecord(subject, record);
				this.clearConflict(subject, record.id);
				database.execSync("COMMIT");
			} catch (error) {
				database.execSync("ROLLBACK");
				throw error;
			}
		},
		listConflicts(subject) {
			return database
				.getAllSync<ConflictRow>(
					"SELECT c.*, r.payload_json, r.revision, r.deleted FROM nutrition_library_conflicts c LEFT JOIN nutrition_library_records r ON r.subject = c.subject AND r.record_id = c.record_id WHERE c.subject = ? ORDER BY c.record_id ASC",
					subject,
				)
				.map((row) => ({
					record: {
						id: row.record_id,
						kind: row.record_kind,
						payload: row.payload_json,
						revision: row.revision ?? 0,
						deleted: row.deleted === 1,
					},
					localPayload: row.local_payload_json,
					serverPayload: row.server_payload_json,
					serverRevision: row.server_revision,
					serverDeleted: row.server_deleted === 1,
				}));
		},
		clearConflict(subject, recordId) {
			database.runSync(
				"DELETE FROM nutrition_library_conflicts WHERE subject = ? AND record_id = ?",
				subject,
				recordId,
			);
		},
		clearOperationsForRecord(subject, recordId) {
			database.runSync(
				"DELETE FROM nutrition_library_operations WHERE subject = ? AND record_id = ?",
				subject,
				recordId,
			);
		},
		adoptServerConflict(subject, record) {
			database.execSync("BEGIN IMMEDIATE");
			try {
				saveRecord(subject, record);
				this.clearOperationsForRecord(subject, record.id);
				this.clearConflict(subject, record.id);
				database.execSync("COMMIT");
			} catch (error) {
				database.execSync("ROLLBACK");
				throw error;
			}
		},
		resolveLocalConflict(subject, record, serverRevision, operationId) {
			const rebased = { ...record, revision: serverRevision };
			database.execSync("BEGIN IMMEDIATE");
			try {
				this.clearOperationsForRecord(subject, record.id);
				this.clearConflict(subject, record.id);
				if (rebased.deleted) {
					this.queueRemove(subject, rebased, operationId);
				} else {
					this.queueUpsert(subject, rebased, operationId);
				}
				database.execSync("COMMIT");
			} catch (error) {
				database.execSync("ROLLBACK");
				throw error;
			}
		},
	};
}

export function openNutritionLibraryStateRepository() {
	return createNutritionLibraryStateRepository(
		openDatabaseSync(
			NUTRITION_LIBRARY_STATE_DATABASE_NAME,
		) as SyncSQLiteDatabase,
	);
}

/** A safe, deterministic filename; account identifiers never become SQL or paths. */
export function nutritionLibraryDatabaseName(subject: string) {
	const encoded = Array.from(new TextEncoder().encode(subject), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return `workouts-nutrition-library-${encoded.slice(0, 160)}.db`;
}

export function libraryRecordFromFood(
	food: PersonalFood,
	revision = 0,
): LibraryRecord {
	return {
		id: food.id,
		kind: "food",
		payload: JSON.stringify(food),
		revision,
		deleted: false,
	};
}

export function libraryRecordFromCombo(
	combo: Combo,
	revision = 0,
): LibraryRecord {
	return {
		id: combo.id,
		kind: "combo",
		payload: JSON.stringify(combo),
		revision,
		deleted: false,
	};
}

export function applyLibraryRecord(
	repository: PersonalFoodRepository,
	record: LibraryRecord,
) {
	const backup = repository.exportBackup();
	const foods = new Map(backup.foods.map((food) => [food.id, food]));
	const combos = new Map(backup.combos.map((combo) => [combo.id, combo]));
	if (record.kind === "food") {
		if (record.deleted) foods.delete(record.id);
		else
			foods.set(
				record.id,
				JSON.parse(record.payload ?? "null") as PersonalFood,
			);
	} else if (record.deleted) combos.delete(record.id);
	else combos.set(record.id, JSON.parse(record.payload ?? "null") as Combo);
	repository.replaceFromBackup({
		foods: [...foods.values()],
		combos: [...combos.values()],
	});
}
