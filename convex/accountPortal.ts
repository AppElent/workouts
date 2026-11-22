import { v } from "convex/values";
import { query } from "./_generated/server";
import { getOptionalUserId, requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";
import {
	accountDeletionBlocker,
	type ExportCursor,
	type ExportTable,
	exportTables,
	readExportStep,
	readPersonalTable,
} from "./lib/personalData";

/**
 * The AppElent account portal contract (developer-home
 * `standards/account-portal.md`, contract 1). Thin wrappers over the export
 * registry (`lib/personalData`) and `account.deletionBlocker`; the caller
 * comes from the token only. Foundry keeps no profile row, so nothing here
 * writes. `deleteAppData` follows with APP-392.
 */

const CONTRACT = 1 as const;
const COUNT_CAP = 1000;

/**
 * `null` for a caller with no Foundry data, else one capped count per
 * exported table (the registry's order and owner index). Foundry does not
 * track a latest write, so `lastActiveAt` is `null`.
 */
export const summary = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			contract: v.literal(CONTRACT),
			lastActiveAt: v.null(),
			counts: v.array(
				v.object({ key: v.string(), count: v.number(), more: v.boolean() }),
			),
		}),
	),
	handler: async (ctx) => {
		const userId = await getOptionalUserId(ctx);
		if (!userId) return null;
		const counts = await Promise.all(
			exportTables.map(async (key) => {
				const rows = await readPersonalTable(ctx.db, key, userId).take(
					COUNT_CAP + 1,
				);
				const more = rows.length > COUNT_CAP;
				return { key, count: more ? COUNT_CAP : rows.length, more };
			}),
		);
		if (counts.every(({ count }) => count === 0)) return null;
		return { contract: CONTRACT, lastActiveAt: null, counts };
	},
});

/** `account.deletionBlocker` as `{ code, params }`: a running Activity. */
export const deletionBlocker = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({ code: v.literal("activeActivity"), params: v.object({}) }),
	),
	handler: async (ctx) => {
		const userId = await getOptionalUserId(ctx);
		const code = userId ? await accountDeletionBlocker(ctx, userId) : null;
		// `accountDeletionBlocker` answers only `"activeActivity"` or null.
		return code === "activeActivity" ? { code, params: {} } : null;
	},
});

function decodeCursor(cursor: string): NonNullable<ExportCursor> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(cursor);
	} catch {
		throw appError("invalid", "cursor");
	}
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!("table" in parsed) ||
		!("cursor" in parsed) ||
		typeof parsed.table !== "string" ||
		!exportTables.includes(parsed.table as ExportTable) ||
		(parsed.cursor !== null && typeof parsed.cursor !== "string")
	)
		throw appError("invalid", "cursor");
	return { table: parsed.table, cursor: parsed.cursor };
}

/**
 * One page of the in-app export (`exportData.personalPage`, same rows and
 * page size), keyed by table. The cursor is that export's step as JSON.
 * Tables that start empty are skipped with one indexed `first()` each, so a
 * never-used caller drains in a single call with no tables.
 */
export const exportPage = query({
	args: { cursor: v.union(v.string(), v.null()) },
	returns: v.object({
		contract: v.literal(CONTRACT),
		app: v.literal("foundry"),
		tables: v.record(v.string(), v.array(v.any())),
		next: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, { cursor }) => {
		const userId = await requireUserId(ctx);
		const step = await readExportStep(
			ctx.db,
			userId,
			cursor === null ? null : decodeCursor(cursor),
		);
		let next = step.next;
		while (next && next.cursor === null) {
			const table = next.table as ExportTable;
			if (await readPersonalTable(ctx.db, table, userId).first()) break;
			const following = exportTables[exportTables.indexOf(table) + 1];
			next = following ? { table: following, cursor: null } : null;
		}
		return {
			contract: CONTRACT,
			app: "foundry" as const,
			tables: step.rows.length > 0 ? { [step.table]: step.rows } : {},
			next: next ? JSON.stringify(next) : null,
		};
	},
});
