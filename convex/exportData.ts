import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";
import {
	type ExportTable,
	exportTables,
	readPersonalTable,
} from "./lib/personalData";

const exportCursor = v.union(
	v.object({ table: v.string(), cursor: v.union(v.string(), v.null()) }),
	v.null(),
);

// Account export walks every exported personal table in order. The cursor
// names the table and its Convex cursor, so each page stays bounded.
export const personalPage = query({
	args: { cursor: exportCursor },
	returns: v.object({
		table: v.string(),
		rows: v.array(v.any()),
		next: exportCursor,
	}),
	handler: async (ctx, { cursor }) => {
		const userId = await requireUserId(ctx);
		const index = cursor
			? exportTables.indexOf(cursor.table as ExportTable)
			: 0;
		if (index < 0) throw appError("invalid", "cursor");
		const table = exportTables[index];
		const page = await readPersonalTable(ctx.db, table, userId).paginate({
			cursor: cursor?.cursor ?? null,
			numItems: 200,
		});
		const following = exportTables[index + 1];
		return {
			table,
			rows: page.page,
			next: !page.isDone
				? { table, cursor: page.continueCursor }
				: following
					? { table: following, cursor: null }
					: null,
		};
	},
});
