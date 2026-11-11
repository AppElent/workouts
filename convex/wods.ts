import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getOptionalUserId, requireOwned, requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";
import { wodDefinitionFields } from "./lib/validators";
import schema from "./schema";

const wodFields = {
	...wodDefinitionFields,
	movements: schema.tables.wods.validator.fields.movements,
};

async function requireOwnWod(ctx: MutationCtx, userId: string, id: Id<"wods">) {
	if ((await ctx.db.get(id))?.isDefault) throw appError("readOnly");
	return requireOwned(ctx, userId, id);
}

/** The benchmark catalog, plus the caller's own WODs when signed in. */
export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getOptionalUserId(ctx);
		const catalog = await ctx.db
			.query("wods")
			.withIndex("by_default", (q) => q.eq("isDefault", true))
			.collect();
		const own = userId
			? await ctx.db
					.query("wods")
					.withIndex("by_user", (q) => q.eq("userId", userId))
					.collect()
			: [];
		// A catalog row that still carries a userId is listed once, as catalog.
		const personal = own.filter((wod) => !wod.isDefault);
		return [...catalog, ...personal].sort((a, b) =>
			a.name.localeCompare(b.name),
		);
	},
});

export const getById = query({
	args: { id: v.id("wods") },
	handler: async (ctx, { id }) => {
		const wod = await ctx.db.get(id);
		if (wod?.isDefault) return wod;
		const userId = await getOptionalUserId(ctx);
		return wod && userId && wod.userId === userId ? wod : null;
	},
});

export const create = mutation({
	args: wodFields,
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		return ctx.db.insert("wods", { ...args, isDefault: false, userId });
	},
});

export const update = mutation({
	args: { id: v.id("wods"), ...wodFields },
	handler: async (ctx, { id, ...fields }) => {
		await requireOwnWod(ctx, await requireUserId(ctx), id);
		await ctx.db.patch(id, fields);
	},
});

export const remove = mutation({
	args: { id: v.id("wods") },
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		await requireOwnWod(ctx, userId, id);
		const results = await ctx.db
			.query("wodResults")
			.withIndex("by_user_wod", (q) => q.eq("userId", userId).eq("wodId", id))
			.collect();
		for (const result of results) await ctx.db.delete(result._id);
		await ctx.db.delete(id);
	},
});
