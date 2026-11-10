import { accountExportJson, collectExportTables } from "@foundry/core";
import type { ConvexReactClient } from "convex/react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "../../convex/api";
import { todayIsoDate } from "../../dates/calendar-day";

/** Drains every exported personal table, page by page, into one JSON file. */
export async function exportAccountData(convex: ConvexReactClient) {
	const tables = await collectExportTables((cursor) =>
		convex.query(api.exportData.personalPage, { cursor }),
	);
	const file = new File(Paths.cache, `foundry-export-${todayIsoDate()}.json`);
	if (file.exists) file.delete();
	file.create();
	file.write(accountExportJson(tables, new Date()));
	await Sharing.shareAsync(file.uri, {
		mimeType: "application/json",
		UTI: "public.json",
	});
}
