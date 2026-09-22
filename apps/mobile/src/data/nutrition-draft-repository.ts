/**
 * Capture Drafts: a note about intake, filed under a day and Meal Slot, that
 * does not count as intake until it becomes Diary Entries (see CONTEXT.md).
 *
 * Drafts are device-only by decision (ADR 0005). They share the cooking
 * database file because that is where the table was born; this module now owns
 * the table, and the cooking repository no longer reads it. The table is
 * created idempotently rather than versioned so either opener can go first.
 */

import { NUTRITION_COOKING_DATABASE_NAME } from "./nutrition-cooking-repository";
import { openNutritionDatabase } from "./nutrition-database";
import { MEAL_SLOTS, type MealSlot } from "./nutrition-day";
import { mintNutritionUuid } from "./nutrition-operation-service";
import type { SyncSQLiteDatabase } from "./personal-food-repository";

export type DraftMeal = MealSlot;

export type CaptureDraft = {
	readonly id: string;
	readonly subject: string;
	readonly date: string;
	readonly meal: DraftMeal;
	readonly note: string;
	readonly createdAt: number;
	readonly updatedAt: number;
};

export type CaptureDraftInput = Pick<CaptureDraft, "date" | "meal" | "note">;

export type OtherDaysSummary = {
	readonly count: number;
	readonly oldestDate: string | undefined;
};

export type NutritionDraftRepository = {
	listForDate(subject: string, date: string): CaptureDraft[];
	/** Drafts on every day except `date` — what the diary's banner reports. */
	summariseOtherDays(subject: string, date: string): OtherDaysSummary;
	get(subject: string, id: string): CaptureDraft | undefined;
	create(subject: string, input: CaptureDraftInput): CaptureDraft;
	update(subject: string, id: string, input: CaptureDraftInput): CaptureDraft;
	remove(subject: string, id: string): boolean;
	close(): void;
};

type DraftRow = {
	subject: string;
	id: string;
	date: string;
	meal: DraftMeal;
	note: string;
	created_at: number;
	updated_at: number;
};

function ensureTable(database: SyncSQLiteDatabase): void {
	// Same shape the cooking store's v1 migration creates, so both agree; the
	// two conversion columns are unused now and simply stay nullable.
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

function text(value: unknown, label: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${label} is required.`);
	}
	return value.trim();
}

function noteText(value: unknown): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error("Draft note is required.");
	}
	return value;
}

function validate(input: CaptureDraftInput): CaptureDraftInput {
	if (!MEAL_SLOTS.includes(input.meal)) {
		throw new Error("Draft meal is invalid.");
	}
	return {
		date: text(input.date, "Draft date"),
		meal: input.meal,
		note: noteText(input.note),
	};
}

function fromRow(row: DraftRow): CaptureDraft {
	return {
		subject: row.subject,
		id: row.id,
		date: row.date,
		meal: row.meal,
		note: row.note,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function createNutritionDraftRepository(
	database: SyncSQLiteDatabase,
	options: { readonly now?: () => number; readonly mintId?: () => string } = {},
): NutritionDraftRepository {
	ensureTable(database);
	const now = options.now ?? Date.now;
	const nextId = options.mintId ?? mintNutritionUuid;

	function get(subject: string, id: string): CaptureDraft | undefined {
		const row = database.getFirstSync<DraftRow>(
			"SELECT * FROM nutrition_capture_drafts WHERE subject = ? AND id = ?",
			subject,
			id,
		);
		return row ? fromRow(row) : undefined;
	}

	return {
		listForDate(subject, date) {
			return database
				.getAllSync<DraftRow>(
					"SELECT * FROM nutrition_capture_drafts WHERE subject = ? AND date = ? ORDER BY created_at ASC, id ASC",
					subject,
					date,
				)
				.map(fromRow);
		},
		summariseOtherDays(subject, date) {
			const row = database.getFirstSync<{
				count: number;
				oldest: string | null;
			}>(
				"SELECT COUNT(*) AS count, MIN(date) AS oldest FROM nutrition_capture_drafts WHERE subject = ? AND date <> ?",
				subject,
				date,
			);
			return { count: row?.count ?? 0, oldestDate: row?.oldest ?? undefined };
		},
		get,
		create(subject, input) {
			const valid = validate(input);
			const timestamp = now();
			const id = nextId();
			database.runSync(
				`INSERT INTO nutrition_capture_drafts(subject, id, date, meal, note, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				subject,
				id,
				valid.date,
				valid.meal,
				valid.note,
				timestamp,
				timestamp,
			);
			const created = get(subject, id);
			if (!created) throw new Error("Draft was not saved.");
			return created;
		},
		update(subject, id, input) {
			const valid = validate(input);
			database.runSync(
				"UPDATE nutrition_capture_drafts SET date = ?, meal = ?, note = ?, updated_at = ? WHERE subject = ? AND id = ?",
				valid.date,
				valid.meal,
				valid.note,
				now(),
				subject,
				id,
			);
			const updated = get(subject, id);
			if (!updated) throw new Error("Draft was not found.");
			return updated;
		},
		remove(subject, id) {
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

export function openNutritionDraftRepository(): NutritionDraftRepository {
	return createNutritionDraftRepository(
		openNutritionDatabase(
			NUTRITION_COOKING_DATABASE_NAME,
		) as SyncSQLiteDatabase,
	);
}
