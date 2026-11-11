import { expect, it } from "vitest";
import {
	type AccountExportPage,
	accountExportJson,
	collectExportTables,
} from "./account-export";

it("follows the cursor across pages and tables until the export ends", async () => {
	const pages: Record<string, AccountExportPage> = {
		start: {
			table: "sets",
			rows: [{ id: 1 }],
			next: { table: "sets", cursor: "2" },
		},
		"sets:2": {
			table: "sets",
			rows: [{ id: 2 }],
			next: { table: "foods", cursor: null },
		},
		"foods:null": {
			table: "foods",
			rows: [],
			next: { table: "goals", cursor: null },
		},
		"goals:null": { table: "goals", rows: [{ id: 3 }], next: null },
	};
	const seen: string[] = [];
	const tables = await collectExportTables(async (cursor) => {
		const key = cursor ? `${cursor.table}:${cursor.cursor}` : "start";
		seen.push(key);
		return pages[key];
	});
	expect(seen).toEqual(["start", "sets:2", "foods:null", "goals:null"]);
	expect(tables).toEqual({
		sets: [{ id: 1 }, { id: 2 }],
		foods: [],
		goals: [{ id: 3 }],
	});
});

it("writes the export time and the tables as indented JSON", () => {
	const json = accountExportJson(
		{ sets: [{ id: 1 }] },
		new Date("2026-11-10T08:00:00Z"),
	);
	expect(JSON.parse(json)).toEqual({
		exportedAt: "2026-11-10T08:00:00.000Z",
		tables: { sets: [{ id: 1 }] },
	});
	expect(json).toContain('\n  "tables"');
});
