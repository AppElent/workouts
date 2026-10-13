import type { ConvexReactClient } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "../../convex/api";
import { todayIsoDate } from "../../data/calendar-day";

type Page = FunctionReturnType<typeof api.exportData.personalPage>;

/** Drains every exported personal table, page by page, into one JSON file. */
export async function exportAccountData(convex: ConvexReactClient) {
	const tables: Record<string, unknown[]> = {};
	let cursor: Page["next"] = null;
	do {
		const page: Page = await convex.query(api.exportData.personalPage, {
			cursor,
		});
		tables[page.table] = [...(tables[page.table] ?? []), ...page.rows];
		cursor = page.next;
	} while (cursor);
	const file = new File(Paths.cache, `workouts-export-${todayIsoDate()}.json`);
	if (file.exists) file.delete();
	file.create();
	file.write(
		JSON.stringify({ exportedAt: new Date().toISOString(), tables }, null, 2),
	);
	await Sharing.shareAsync(file.uri, {
		mimeType: "application/json",
		UTI: "public.json",
	});
}
