import { File } from "expo-file-system";
import { defaultDatabaseDirectory } from "expo-sqlite";
import { openNutritionDatabase } from "./nutrition-database";
import type {
	Combo,
	PersonalFood,
	PersonalFoodRepository,
	SyncSQLiteDatabase,
} from "./personal-food-repository";
import { portablePersonalFood } from "./personal-food-repository";

export const NUTRITION_LIBRARY_STATE_DATABASE_NAME =
	"workouts-nutrition-library-state.db";
const DATABASE_VERSION = 4;

export type LibraryRecordKind = "food" | "combo";
export type LibraryRecord = {
	readonly subject?: string;
	readonly id: string;
	readonly kind: LibraryRecordKind;
	readonly payload: string | null;
	readonly schemaVersion?: 1 | 2 | 3;
	readonly revision: number;
	readonly deleted: boolean;
};

type Row = {
	record_id: string;
	record_kind: LibraryRecordKind;
	payload_json: string | null;
	schema_version: 1 | 2 | 3;
	revision: number;
	deleted: number;
};

function migrate(database: SyncSQLiteDatabase) {
	const version =
		database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
			?.user_version ?? 0;
	if (version > DATABASE_VERSION)
		throw new Error("This nutrition library cache is newer than this app.");
	if (version === DATABASE_VERSION) return;
	database.execSync("BEGIN IMMEDIATE");
	try {
		for (const table of [
			"nutrition_library_operations",
			"nutrition_library_prepared",
			"nutrition_library_conflicts",
		]) {
			if (
				database.getFirstSync(
					"SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
					table,
				) &&
				database.getFirstSync(`SELECT 1 FROM ${table} LIMIT 1`)
			)
				throw new Error(
					"Upload legacy library changes with build 20 before updating this app.",
				);
		}
		database.execSync(`CREATE TABLE IF NOT EXISTS nutrition_library_records (
			subject TEXT NOT NULL, record_id TEXT NOT NULL, record_kind TEXT NOT NULL,
			payload_json TEXT, revision INTEGER NOT NULL, deleted INTEGER NOT NULL,
			schema_version INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(subject, record_id));`);
		if (version > 0 && version < 3)
			database.execSync(
				"ALTER TABLE nutrition_library_records ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1",
			);
		for (const table of [
			"nutrition_library_settings",
			"nutrition_library_operations",
			"nutrition_library_prepared",
			"nutrition_library_conflicts",
			"nutrition_library_legacy_claim",
		])
			database.execSync(`DROP TABLE IF EXISTS ${table}`);
		database.execSync("PRAGMA user_version = 4; COMMIT");
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
		schemaVersion: row.schema_version,
		revision: row.revision,
		deleted: row.deleted === 1,
	};
}

export type NutritionLibraryStateRepository = {
	getRecord(subject: string, id: string): LibraryRecord | undefined;
	listRecords(subject: string): LibraryRecord[];
	commitServerRecord(subject: string, record: LibraryRecord): void;
	close(): void;
};

/** A disposable record/revision cache; no local write queue or migration state. */
export function createNutritionLibraryStateRepository(
	database: SyncSQLiteDatabase,
): NutritionLibraryStateRepository {
	migrate(database);
	const saveRecord = (subject: string, record: LibraryRecord) => {
		database.runSync(
			`INSERT INTO nutrition_library_records(subject, record_id, record_kind, payload_json, revision, deleted, schema_version)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(subject, record_id) DO UPDATE SET
			 record_kind = excluded.record_kind, payload_json = excluded.payload_json,
			 revision = excluded.revision, deleted = excluded.deleted, schema_version = excluded.schema_version`,
			subject,
			record.id,
			record.kind,
			record.payload,
			record.revision,
			record.deleted ? 1 : 0,
			record.schemaVersion ?? 1,
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
		getRecord,
		listRecords(subject) {
			return database
				.getAllSync<Row>(
					"SELECT * FROM nutrition_library_records WHERE subject = ?",
					subject,
				)
				.map(recordFromRow);
		},
		commitServerRecord(subject, record) {
			saveRecord(subject, record);
		},
		close() {
			(
				database as SyncSQLiteDatabase & { closeSync?: () => void }
			).closeSync?.();
		},
	};
}

export function openNutritionLibraryStateRepository() {
	const file = new File(
		defaultDatabaseDirectory,
		NUTRITION_LIBRARY_STATE_DATABASE_NAME,
	);
	if (file.exists) {
		const old = createNutritionLibraryStateRepository(
			openNutritionDatabase(NUTRITION_LIBRARY_STATE_DATABASE_NAME),
		);
		old.close();
		file.delete();
	}
	return createNutritionLibraryStateRepository(
		openNutritionDatabase(":memory:"),
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
		payload: JSON.stringify(portablePersonalFood(food)),
		schemaVersion: 2,
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
		schemaVersion: 2,
		revision,
		deleted: false,
	};
}

export function applyLibraryRecord(
	repository: PersonalFoodRepository,
	record: LibraryRecord,
) {
	if (record.deleted) {
		if (record.kind === "food") repository.remove(record.id);
		else repository.removeCombo(record.id);
		return;
	}
	if (record.kind === "combo") {
		repository.replaceFromBackup(
			{ foods: [], combos: [JSON.parse(record.payload ?? "null") as Combo] },
			{ merge: true, preserveLocalPhotos: true },
		);
		return;
	}
	const incoming = JSON.parse(record.payload ?? "null") as PersonalFood;
	const current = repository.find(record.id);
	const food =
		!incoming.visual && current?.visual?.kind === "photo"
			? { ...incoming, visual: current.visual }
			: incoming;
	repository.replaceFromBackup(
		{ foods: [food], combos: [] },
		{ merge: true, preserveLocalPhotos: true },
	);
}
