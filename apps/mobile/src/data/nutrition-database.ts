import { openDatabaseSync } from "expo-sqlite";

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
	withTransactionSync(task: () => void): void;
};

/** Each repository owns its connection, even when it shares a database file. */
export function openNutritionDatabase(
	name: string,
): SyncSQLiteDatabase & { closeSync(): void } {
	// SDK 57 Android can release a cached native handle while another JS wrapper
	// still uses it. Independent connections also isolate repository close().
	// https://github.com/expo/expo/issues/48999
	return openDatabaseSync(name, { useNewConnection: true });
}
