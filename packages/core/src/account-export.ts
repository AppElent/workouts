/** Where an export page starts: a table and its Convex cursor. */
type AccountExportCursor = { table: string; cursor: string | null };

/** One page of the personal-data export (`exportData.personalPage`). */
export type AccountExportPage = {
	readonly table: string;
	readonly rows: readonly unknown[];
	/** Where the next page starts; `null` after the last one. */
	readonly next: AccountExportCursor | null;
};

type AccountExportTables = Record<string, unknown[]>;

export async function collectExportTables(
	fetchPage: (cursor: AccountExportCursor | null) => Promise<AccountExportPage>,
): Promise<AccountExportTables> {
	const tables: AccountExportTables = {};
	let cursor: AccountExportCursor | null = null;
	do {
		const page = await fetchPage(cursor);
		const rows = tables[page.table] ?? [];
		tables[page.table] = rows;
		for (const row of page.rows) rows.push(row);
		cursor = page.next;
	} while (cursor !== null);
	return tables;
}

/** The account export file both apps hand to the person. */
export function accountExportJson(
	tables: AccountExportTables,
	exportedAt: Date,
): string {
	return JSON.stringify(
		{ exportedAt: exportedAt.toISOString(), tables },
		null,
		2,
	);
}
