import { openDatabaseSync } from "expo-sqlite";
import { mintNutritionUuid } from "./nutrition-operation-service";
import type { SyncSQLiteDatabase } from "./personal-food-repository";

export const NUTRITION_COOKING_DATABASE_NAME = "workouts-nutrition-cooking.db";
const DATABASE_VERSION = 1;

export type CaptureDraft = {
	readonly id: string;
	readonly subject: string;
	readonly date: string;
	readonly meal: "breakfast" | "lunch" | "dinner" | "snacks";
	readonly note: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly conversionClientEntryId?: string;
	readonly conversionOperationId?: string;
};

export type NutritionCookingRepository = {
	listDrafts(subject: string): CaptureDraft[];
	getDraft(subject: string, id: string): CaptureDraft | undefined;
	createDraft(
		subject: string,
		draft: Pick<CaptureDraft, "date" | "meal" | "note">,
	): CaptureDraft;
	updateDraft(
		subject: string,
		id: string,
		draft: Pick<CaptureDraft, "date" | "meal" | "note">,
	): CaptureDraft;
	beginDraftConversion(
		subject: string,
		id: string,
		clientEntryId: string,
	): CaptureDraft;
	setDraftConversionOperation(
		subject: string,
		id: string,
		operationId: string,
	): CaptureDraft;
	clearDraftConversion(subject: string, id: string): CaptureDraft;
	removeDraft(subject: string, id: string): boolean;
	close(): void;
};

type DraftRow = {
	subject: string;
	id: string;
	date: string;
	meal: CaptureDraft["meal"];
	note: string;
	conversion_client_entry_id: string | null;
	conversion_operation_id: string | null;
	created_at: number;
	updated_at: number;
};

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

function migrate(database: SyncSQLiteDatabase): void {
	const current =
		database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
			?.user_version ?? 0;
	if (current > DATABASE_VERSION) {
		throw new Error("This cooking database is newer than this app version.");
	}
	if (current === DATABASE_VERSION) return;
	transaction(database, () => {
		if (current < 1) {
			database.execSync(`
				CREATE TABLE IF NOT EXISTS nutrition_capture_drafts (
					subject TEXT NOT NULL,
					id TEXT NOT NULL,
					date TEXT NOT NULL,
					meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snacks')),
					note TEXT NOT NULL,
					conversion_client_entry_id TEXT,
					conversion_operation_id TEXT,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL,
					PRIMARY KEY (subject, id)
				);
				CREATE INDEX IF NOT EXISTS nutrition_capture_drafts_by_date
					ON nutrition_capture_drafts(subject, date ASC, created_at ASC, id ASC);
			`);
		}
		database.execSync(`PRAGMA user_version = ${DATABASE_VERSION}`);
	});
}

function text(value: unknown, label: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${label} is required.`);
	}
	return value.trim();
}

function draftFromRow(row: DraftRow): CaptureDraft {
	return {
		subject: row.subject,
		id: row.id,
		date: row.date,
		meal: row.meal,
		note: row.note,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		...(row.conversion_client_entry_id
			? { conversionClientEntryId: row.conversion_client_entry_id }
			: {}),
		...(row.conversion_operation_id
			? { conversionOperationId: row.conversion_operation_id }
			: {}),
	};
}

export function createNutritionCookingRepository(
	database: SyncSQLiteDatabase,
	options: { readonly now?: () => number; readonly mintId?: () => string } = {},
): NutritionCookingRepository {
	migrate(database);
	const now = options.now ?? Date.now;
	const nextId = options.mintId ?? mintNutritionUuid;

	function getDraft(subject: string, id: string): CaptureDraft | undefined {
		const row = database.getFirstSync<DraftRow>(
			"SELECT * FROM nutrition_capture_drafts WHERE subject = ? AND id = ?",
			subject,
			id,
		);
		return row ? draftFromRow(row) : undefined;
	}

	return {
		listDrafts(subject) {
			return database
				.getAllSync<DraftRow>(
					"SELECT * FROM nutrition_capture_drafts WHERE subject = ? ORDER BY date DESC, created_at ASC, id ASC",
					subject,
				)
				.map(draftFromRow);
		},
		getDraft,
		createDraft(subject, draft) {
			const date = text(draft.date, "Draft date");
			const note = text(draft.note, "Draft note");
			if (!["breakfast", "lunch", "dinner", "snacks"].includes(draft.meal)) {
				throw new Error("Draft meal is invalid.");
			}
			const timestamp = now();
			const id = nextId();
			database.runSync(
				`INSERT INTO nutrition_capture_drafts(subject, id, date, meal, note, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				subject,
				id,
				date,
				draft.meal,
				note,
				timestamp,
				timestamp,
			);
			const created = getDraft(subject, id);
			if (!created) throw new Error("Draft was not saved.");
			return created;
		},
		updateDraft(subject, id, draft) {
			const date = text(draft.date, "Draft date");
			const note = text(draft.note, "Draft note");
			if (!["breakfast", "lunch", "dinner", "snacks"].includes(draft.meal)) {
				throw new Error("Draft meal is invalid.");
			}
			database.runSync(
				"UPDATE nutrition_capture_drafts SET date = ?, meal = ?, note = ?, updated_at = ? WHERE subject = ? AND id = ?",
				date,
				draft.meal,
				note,
				now(),
				subject,
				id,
			);
			const updated = getDraft(subject, id);
			if (!updated) throw new Error("Draft was not found.");
			return updated;
		},
		beginDraftConversion(subject, id, clientEntryId) {
			text(clientEntryId, "Conversion client entry id");
			const existing = getDraft(subject, id);
			if (!existing) throw new Error("Draft was not found.");
			if (existing.conversionClientEntryId) return existing;
			database.runSync(
				"UPDATE nutrition_capture_drafts SET conversion_client_entry_id = ?, updated_at = ? WHERE subject = ? AND id = ?",
				clientEntryId,
				now(),
				subject,
				id,
			);
			const marked = getDraft(subject, id);
			if (!marked) throw new Error("Draft conversion could not be prepared.");
			return marked;
		},
		setDraftConversionOperation(subject, id, operationId) {
			text(operationId, "Conversion operation id");
			database.runSync(
				"UPDATE nutrition_capture_drafts SET conversion_operation_id = ?, updated_at = ? WHERE subject = ? AND id = ?",
				operationId,
				now(),
				subject,
				id,
			);
			const updated = getDraft(subject, id);
			if (!updated) throw new Error("Draft was not found.");
			return updated;
		},
		clearDraftConversion(subject, id) {
			database.runSync(
				"UPDATE nutrition_capture_drafts SET conversion_client_entry_id = NULL, conversion_operation_id = NULL, updated_at = ? WHERE subject = ? AND id = ?",
				now(),
				subject,
				id,
			);
			const updated = getDraft(subject, id);
			if (!updated) throw new Error("Draft was not found.");
			return updated;
		},
		removeDraft(subject, id) {
			return (
				database.runSync(
					"DELETE FROM nutrition_capture_drafts WHERE subject = ? AND id = ?",
					subject,
					id,
				).changes > 0
			);
		},
		close() {
			(
				database as SyncSQLiteDatabase & { closeSync?: () => void }
			).closeSync?.();
		},
	};
}

export function openNutritionCookingRepository(
	idFactory: () => string = mintNutritionUuid,
): NutritionCookingRepository {
	return createNutritionCookingRepository(
		openDatabaseSync(NUTRITION_COOKING_DATABASE_NAME) as SyncSQLiteDatabase,
		{ mintId: idFactory },
	);
}
