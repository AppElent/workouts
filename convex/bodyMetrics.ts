import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwned, requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";
import { withCreateReceipt } from "./lib/operationReceipt";
import { loadUnit } from "./lib/validators";

const LIMITS = {
	weight: { min: 1, max: 1000 },
	bodyFatPct: { min: 1, max: 75 },
	chest: { min: 1, max: 300 },
	waist: { min: 1, max: 300 },
	arms: { min: 1, max: 150 },
	thighs: { min: 1, max: 200 },
};

function checkLimits(values: Partial<Record<keyof typeof LIMITS, number>>) {
	for (const [field, value] of Object.entries(values)) {
		if (value === undefined) continue;
		const { min, max } = LIMITS[field as keyof typeof LIMITS];
		if (!Number.isFinite(value) || value < min || value > max)
			throw appError("invalid", field);
	}
}

const measurementsValidator = v.optional(
	v.object({
		chest: v.optional(v.number()),
		waist: v.optional(v.number()),
		arms: v.optional(v.number()),
		thighs: v.optional(v.number()),
	}),
);

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		return ctx.db
			.query("bodyMetrics")
			.withIndex("by_user_date", (q) => q.eq("userId", userId))
			.order("desc")
			.collect();
	},
});

export const latest = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		return ctx.db
			.query("bodyMetrics")
			.withIndex("by_user_date", (q) => q.eq("userId", userId))
			.order("desc")
			.first();
	},
});

export const add = mutation({
	args: {
		operationId: v.optional(v.string()),
		// Connected apps back-date a measurement they were told about.
		date: v.optional(v.number()),
		weight: v.optional(v.number()),
		unit: loadUnit,
		bodyFatPct: v.optional(v.number()),
		measurements: measurementsValidator,
		notes: v.optional(v.string()),
	},
	handler: async (ctx, { operationId, ...args }) => {
		const userId = await requireUserId(ctx);
		checkLimits({
			weight: args.weight,
			bodyFatPct: args.bodyFatPct,
			...args.measurements,
		});
		if (
			args.weight === undefined &&
			args.bodyFatPct === undefined &&
			!args.measurements
		)
			throw appError("empty");
		return withCreateReceipt(
			ctx,
			userId,
			{ operationId, kind: "bodyMetric", payload: args },
			() =>
				ctx.db.insert("bodyMetrics", {
					userId,
					date: args.date ?? Date.now(),
					weight: args.weight,
					unit: args.unit,
					bodyFatPct: args.bodyFatPct,
					measurements: args.measurements,
					notes: args.notes,
				}),
		);
	},
});

export const remove = mutation({
	args: { id: v.id("bodyMetrics") },
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		await requireOwned(ctx, userId, id);
		await ctx.db.delete(id);
	},
});
