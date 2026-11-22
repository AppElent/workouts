import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { readExportStep } from "./lib/personalData";

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
		return await readExportStep(ctx.db, userId, cursor);
	},
});
