import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const unitValidator = v.union(v.literal("g"), v.literal("ml"));
const measureValidator = v.object({
	id: v.id("personalMeasures"),
	name: v.string(),
	amount: v.number(),
	unit: unitValidator,
	order: v.number(),
});

async function requireUser(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthenticated");
	return identity.subject;
}

function normalizeName(name: string) {
	return name.trim().toLowerCase();
}

function validateInput(name: string, amount: number) {
	const trimmedName = name.trim();
	if (trimmedName.length < 1 || trimmedName.length > 40) {
		throw new Error("Name must contain between 1 and 40 characters.");
	}
	if (
		!Number.isFinite(amount) ||
		amount <= 0 ||
		amount > 10_000 ||
		Math.abs(amount * 10 - Math.round(amount * 10)) > 1e-9
	) {
		throw new Error(
			"Amount must be greater than zero, at most 10000, and use at most one decimal place.",
		);
	}
	return { name: trimmedName, normalizedName: normalizeName(trimmedName) };
}

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
	if (existing && existing._id !== exceptId) {
		throw new Error("A Personal Measure with this name already exists.");
	}
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
		const userId = await requireUser(ctx);
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
		const userId = await requireUser(ctx);
		const { name, normalizedName } = validateInput(rawName, amount);
		await assertUniqueName(ctx, userId, normalizedName);
		const last = await ctx.db
			.query("personalMeasures")
			.withIndex("by_user_and_order", (q) => q.eq("userId", userId))
			.order("desc")
			.first();
		const order = (last?.order ?? -1) + 1;
		const id = await ctx.db.insert("personalMeasures", {
			userId,
			name,
			normalizedName,
			amount,
			unit,
			order,
		});
		const created = await ctx.db.get(id);
		if (!created) throw new Error("Personal Measure was not created.");
		return asMeasure(created);
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
		const userId = await requireUser(ctx);
		const current = await ctx.db.get(id);
		if (!current || current.userId !== userId) {
			throw new Error("Personal Measure not found.");
		}
		const { name, normalizedName } = validateInput(rawName, amount);
		await assertUniqueName(ctx, userId, normalizedName, id);
		await ctx.db.patch(id, { name, normalizedName, amount, unit });
		return asMeasure({ ...current, name, normalizedName, amount, unit });
	},
});

export const reorder = mutation({
	args: { ids: v.array(v.id("personalMeasures")) },
	returns: v.null(),
	handler: async (ctx, { ids }) => {
		const userId = await requireUser(ctx);
		if (new Set(ids).size !== ids.length) {
			throw new Error("Personal Measure order contains duplicate IDs.");
		}
		const owned = await ctx.db
			.query("personalMeasures")
			.withIndex("by_user_and_order", (q) => q.eq("userId", userId))
			.take(ids.length + 1);
		if (
			owned.length !== ids.length ||
			owned.some((row) => !ids.includes(row._id))
		) {
			throw new Error("Personal Measure order must include every owned measure.");
		}
		await Promise.all(
			ids.map((id, order) => ctx.db.patch(id, { order })),
		);
		return null;
	},
});

export const remove = mutation({
	args: { id: v.id("personalMeasures") },
	returns: v.null(),
	handler: async (ctx, { id }) => {
		const userId = await requireUser(ctx);
		const current = await ctx.db.get(id);
		if (!current || current.userId !== userId) {
			throw new Error("Personal Measure not found.");
		}
		await ctx.db.delete(id);
		return null;
	},
});
