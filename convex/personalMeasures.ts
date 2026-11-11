import { validateNamedAmount } from "@foundry/core";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireOwned, requireUserId } from "./lib/auth";
import { appError, checked } from "./lib/errors";
import { measuredUnit as unitValidator } from "./lib/validators";

const measureValidator = v.object({
	id: v.id("personalMeasures"),
	name: v.string(),
	amount: v.number(),
	unit: unitValidator,
	order: v.number(),
});

async function assertUniqueName(
	ctx: MutationCtx,
	userId: string,
	normalizedName: string,
	exceptId?: Id<"personalMeasures">,
) {
	const existing = await ctx.db
		.query("personalMeasures")
		.withIndex("by_user_and_normalized_name", (q) =>
			q.eq("userId", userId).eq("normalizedName", normalizedName),
		)
		.first();
	if (existing && existing._id !== exceptId)
		throw appError("duplicate", "name");
}

function asMeasure(row: Doc<"personalMeasures">) {
	return {
		id: row._id,
		name: row.name,
		amount: row.amount,
		unit: row.unit,
		order: row.order,
	};
}

export const list = query({
	args: { paginationOpts: paginationOptsValidator },
	returns: v.object({
		page: v.array(measureValidator),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, { paginationOpts }) => {
		const userId = await requireUserId(ctx);
		const page = await ctx.db
			.query("personalMeasures")
			.withIndex("by_user_and_order", (q) => q.eq("userId", userId))
			.order("asc")
			.paginate(paginationOpts);
		return {
			page: page.page.map(asMeasure),
			isDone: page.isDone,
			continueCursor: page.continueCursor,
		};
	},
});

export const create = mutation({
	args: { name: v.string(), amount: v.number(), unit: unitValidator },
	returns: measureValidator,
	handler: async (ctx, { name: rawName, amount, unit }) => {
		const userId = await requireUserId(ctx);
		const { name, normalizedName } = checked(
			validateNamedAmount({ name: rawName, amount }, "measure"),
		);
		await assertUniqueName(ctx, userId, normalizedName);
		const last = await ctx.db
			.query("personalMeasures")
			.withIndex("by_user_and_order", (q) => q.eq("userId", userId))
			.order("desc")
			.first();
		const order = (last?.order ?? -1) + 1;
		const row = { userId, name, normalizedName, amount, unit, order };
		const id = await ctx.db.insert("personalMeasures", row);
		return asMeasure({ ...row, _id: id, _creationTime: Date.now() });
	},
});

export const update = mutation({
	args: {
		id: v.id("personalMeasures"),
		name: v.string(),
		amount: v.number(),
		unit: unitValidator,
	},
	returns: measureValidator,
	handler: async (ctx, { id, name: rawName, amount, unit }) => {
		const userId = await requireUserId(ctx);
		const current = await requireOwned(ctx, userId, id);
		const { name, normalizedName } = checked(
			validateNamedAmount({ name: rawName, amount }, "measure"),
		);
		await assertUniqueName(ctx, userId, normalizedName, id);
		await ctx.db.patch(id, { name, normalizedName, amount, unit });
		return asMeasure({ ...current, name, normalizedName, amount, unit });
	},
});

export const reorder = mutation({
	args: { ids: v.array(v.id("personalMeasures")) },
	returns: v.null(),
	handler: async (ctx, { ids }) => {
		const userId = await requireUserId(ctx);
		if (new Set(ids).size !== ids.length) throw appError("invalid", "ids");
		const owned = await ctx.db
			.query("personalMeasures")
			.withIndex("by_user_and_order", (q) => q.eq("userId", userId))
			.take(ids.length + 1);
		if (
			owned.length !== ids.length ||
			owned.some((row) => !ids.includes(row._id))
		)
			throw appError("invalid", "ids");
		await Promise.all(ids.map((id, order) => ctx.db.patch(id, { order })));
		return null;
	},
});

export const remove = mutation({
	args: { id: v.id("personalMeasures") },
	returns: v.null(),
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		await requireOwned(ctx, userId, id);
		await ctx.db.delete(id);
		return null;
	},
});
