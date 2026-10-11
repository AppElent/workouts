import { Directory, File } from "expo-file-system";
import { defaultDatabaseDirectory } from "expo-sqlite";
import { openNutritionDatabase } from "./nutrition-database";
import type { SyncSQLiteDatabase } from "./personal-food-repository";

export type LocalTable = {
	name: string;
	count: number;
	columns: { name: string; type: string; pk: number }[];
};
export type LocalRow = Record<string, unknown>;

/** Enumerate existing app databases only; inspection never runs repository migrations. */
export function listLocalDatabases(): string[] {
	if (!__DEV__)
		throw new Error(
			"SQLite inspection is available in development builds only.",
		);
	const directory = new Directory(defaultDatabaseDirectory);
	if (!directory.exists) return [];
	return directory
		.list()
		.filter(
			(entry) =>
				entry instanceof File &&
				(entry.name === "ExpoSQLiteStorage" ||
					(entry.name.startsWith("workouts-") && entry.name.endsWith(".db"))),
		)
		.map((entry) => entry.name)
		.sort();
}

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** Separate connection with SQLite's query-only protection; no edit or arbitrary SQL API. */
export function openLocalDatabaseInspector(name: string) {
	if (!listLocalDatabases().includes(name))
		throw new Error("This local database is unavailable.");
	const database = openNutritionDatabase(name);
	try {
		return createLocalDatabaseInspector(database);
	} catch (error) {
		database.closeSync();
		throw error;
	}
}

export function createLocalDatabaseInspector(
	database: SyncSQLiteDatabase & { closeSync(): void },
) {
	database.execSync("PRAGMA query_only = ON");
	const names = database
		.getAllSync<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
		)
		.map((table) => table.name);
	function table(name: string): LocalTable {
		if (!names.includes(name))
			throw new Error("This local table is unavailable.");
		return {
			name,
			count:
				database.getFirstSync<{ count: number }>(
					`SELECT COUNT(*) AS count FROM ${quote(name)}`,
				)?.count ?? 0,
			columns: database.getAllSync<LocalTable["columns"][number]>(
				`PRAGMA table_info(${quote(name)})`,
			),
		};
	}
	return {
		listTables: () => names.map(table),
		readPage: (name: string, page: number) => {
			if (!Number.isSafeInteger(page) || page < 0)
				throw new Error("Invalid local table page.");
			const details = table(name);
			const primary = details.columns
				.filter((column) => column.pk)
				.sort((a, b) => a.pk - b.pk);
			const order = primary.length
				? primary.map((column) => quote(column.name)).join(", ")
				: "rowid";
			return {
				...details,
				page,
				rows: database.getAllSync<LocalRow>(
					`SELECT * FROM ${quote(name)} ORDER BY ${order} LIMIT 25 OFFSET ?`,
					page * 25,
				),
			};
		},
		close: () => database.closeSync(),
	};
}
