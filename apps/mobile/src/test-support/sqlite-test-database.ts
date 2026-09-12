/// <reference types="node" />

import { DatabaseSync } from "node:sqlite";
import type { SQLiteValue } from "../data/personal-food-repository";

/**
 * A real in-memory SQLite database with expo-sqlite's synchronous method names.
 * Repository tests therefore exercise SQLite itself, not a SQL-shaped mock.
 */
export class SQLiteTestDatabase {
	readonly database: DatabaseSync;

	constructor(path = ":memory:") {
		this.database = new DatabaseSync(path);
	}

	execSync(source: string): void {
		this.database.exec(source);
	}

	runSync(source: string, ...params: SQLiteValue[]) {
		const result = this.database.prepare(source).run(...params);
		return {
			changes: Number(result.changes),
			lastInsertRowId: Number(result.lastInsertRowid),
		};
	}

	getFirstSync<T>(source: string, ...params: SQLiteValue[]): T | null {
		return (
			(this.database.prepare(source).get(...params) as T | undefined) ?? null
		);
	}

	getAllSync<T>(source: string, ...params: SQLiteValue[]): T[] {
		return this.database.prepare(source).all(...params) as T[];
	}

	closeSync(): void {
		this.database.close();
	}
}
