import { validateNamedAmount } from "@foundry/core";
import { getShippedFood } from "@foundry/core/shipped-foods";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { appError, checked } from "./lib/errors";
import { measuredUnit } from "./lib/validators";

const serving = v.object({
	id: v.id("supplementaryServings"),
	foodId: v.string(),
	name: v.string(),
	amount: v.number(),
	unit: measuredUnit,
});

function present(row: Doc<"supplementaryServings">) {
	return {
		id: row._id,
		foodId: row.foodId,
		name: row.name,
		amount: row.amount,
		unit: row.unit,
	};
}

export const list = query({
	args: { foodId: v.string(), paginationOpts: paginationOptsValidator },
	returns: v.object({
		page: v.array(serving),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const result = await ctx.db
			.query("supplementaryServings")
			.withIndex("by_userId_and_foodId", (q) =>
				q.eq("userId", userId).eq("foodId", args.foodId),
			)
			.paginate(args.paginationOpts);
		return {
			isDone: result.isDone,
			continueCursor: result.continueCursor,
			page: result.page.map(present),
		};
	},
});

/** Adds a named serving to a shipped food, in the food's own base unit. */
export const create = mutation({
	args: {
		foodId: v.string(),
		name: v.string(),
		amount: v.number(),
		unit: measuredUnit,
	},
	returns: serving,
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const food = getShippedFood(args.foodId);
		if (!food) throw appError("notFound", "foodId");
		if (food.baseUnit !== args.unit) throw appError("invalid", "unit");
		const { name, normalizedName, amount } = checked(
			validateNamedAmount(args, "serving"),
		);
		const existing = await ctx.db
			.query("supplementaryServings")
			.withIndex("by_userId_and_foodId_and_normalizedName", (q) =>
				q
					.eq("userId", userId)
					.eq("foodId", args.foodId)
					.eq("normalizedName", normalizedName),
			)
			.first();
		if (existing) throw appError("duplicate", "name");
		const row = {
			userId,
			foodId: args.foodId,
			name,
			normalizedName,
			amount,
			unit: args.unit,
		};
		const id = await ctx.db.insert("supplementaryServings", row);
		return present({ ...row, _id: id, _creationTime: Date.now() });
	},
});
