import { validateEnduranceInput } from "@foundry/core";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getOwned, requireOwned, requireUserId } from "./lib/auth";
import { appError, checked } from "./lib/errors";
import {
	enduranceEnvironment as environment,
	enduranceSport as sport,
} from "./lib/validators";

const requiredFields = {
	occurredAt: v.number(),
	durationSeconds: v.number(),
	distanceMeters: v.number(),
};

const optionalFields = {
	title: v.optional(v.string()),
	notes: v.optional(v.string()),
	environment: v.optional(environment),
	elevationGainMeters: v.optional(v.number()),
	averageHeartRate: v.optional(v.number()),
	effort: v.optional(v.number()),
};

const editableFields = {
	title: v.optional(v.union(v.string(), v.null())),
	notes: v.optional(v.union(v.string(), v.null())),
	environment: v.optional(v.union(environment, v.null())),
	elevationGainMeters: v.optional(v.union(v.number(), v.null())),
	averageHeartRate: v.optional(v.union(v.number(), v.null())),
	effort: v.optional(v.union(v.number(), v.null())),
};

const detailReturn = v.union(
	v.null(),
	v.object({
		id: v.id("activities"),
		sport,
		occurredAt: v.number(),
		durationSeconds: v.number(),
		distanceMeters: v.number(),
		title: v.optional(v.string()),
		notes: v.optional(v.string()),
		environment: v.optional(environment),
		elevationGainMeters: v.optional(v.number()),
		averageHeartRate: v.optional(v.number()),
		effort: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}),
);

async function requireDetails(ctx: QueryCtx, activityId: Id<"activities">) {
	const details = await ctx.db
		.query("enduranceActivityDetails")
		.withIndex("by_activity", (q) => q.eq("activityId", activityId))
		.unique();
	if (!details)
		throw new Error(`Activity ${activityId} has no endurance details`);
	return details;
}

export const create = mutation({
	args: {
		clientEntryId: v.string(),
		sport,
		...requiredFields,
		...optionalFields,
	},
	returns: v.id("activities"),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		if (!args.clientEntryId.trim() || args.clientEntryId.length > 200)
			throw appError("invalid", "clientEntryId");
		checked(validateEnduranceInput(args));
		const existing = await ctx.db
			.query("activities")
			.withIndex("by_user_client_entry", (q) =>
				q.eq("userId", userId).eq("clientEntryId", args.clientEntryId),
			)
			.unique();
		if (existing) {
			const saved = await requireDetails(ctx, existing._id);
			const matches =
				existing.sport === args.sport &&
				existing.occurredAt === args.occurredAt &&
				existing.durationSeconds === args.durationSeconds &&
				existing.title === args.title &&
				existing.notes === args.notes &&
				saved.distanceMeters === args.distanceMeters &&
				saved.environment === args.environment &&
				saved.elevationGainMeters === args.elevationGainMeters &&
				saved.averageHeartRate === args.averageHeartRate &&
				saved.effort === args.effort;
			if (!matches) throw appError("operationConflict");
			return existing._id;
		}
		const now = Date.now();
		const id = await ctx.db.insert("activities", {
			userId,
			clientEntryId: args.clientEntryId,
			sport: args.sport,
			occurredAt: args.occurredAt,
			durationSeconds: args.durationSeconds,
			title: args.title,
			notes: args.notes,
			createdAt: now,
			updatedAt: now,
		});
		await ctx.db.insert("enduranceActivityDetails", {
			activityId: id,
			userId,
			distanceMeters: args.distanceMeters,
			environment: args.environment,
			elevationGainMeters: args.elevationGainMeters,
			averageHeartRate: args.averageHeartRate,
			effort: args.effort,
		});
		return id;
	},
});

export const get = query({
	args: { id: v.id("activities") },
	returns: detailReturn,
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		const activity = await getOwned(ctx, userId, id);
		if (!activity) return null;
		const detail = await requireDetails(ctx, id);
		return {
			id,
			sport: activity.sport,
			occurredAt: activity.occurredAt,
			durationSeconds: activity.durationSeconds,
			distanceMeters: detail.distanceMeters,
			title: activity.title,
			notes: activity.notes,
			environment: detail.environment,
			elevationGainMeters: detail.elevationGainMeters,
			averageHeartRate: detail.averageHeartRate,
			effort: detail.effort,
			createdAt: activity.createdAt,
			updatedAt: activity.updatedAt,
		};
	},
});

export const update = mutation({
	args: { id: v.id("activities"), ...requiredFields, ...editableFields },
	returns: v.null(),
	handler: async (ctx, { id, ...input }) => {
		const userId = await requireUserId(ctx);
		const activity = await requireOwned(ctx, userId, id);
		checked(validateEnduranceInput(input));
		const detail = await requireDetails(ctx, id);
		await ctx.db.patch(id, {
			occurredAt: input.occurredAt,
			durationSeconds: input.durationSeconds,
			title: input.title === null ? undefined : (input.title ?? activity.title),
			notes: input.notes === null ? undefined : (input.notes ?? activity.notes),
			updatedAt: Date.now(),
		});
		await ctx.db.patch(detail._id, {
			distanceMeters: input.distanceMeters,
			environment:
				input.environment === null
					? undefined
					: (input.environment ?? detail.environment),
			elevationGainMeters:
				input.elevationGainMeters === null
					? undefined
					: (input.elevationGainMeters ?? detail.elevationGainMeters),
			averageHeartRate:
				input.averageHeartRate === null
					? undefined
					: (input.averageHeartRate ?? detail.averageHeartRate),
			effort:
				input.effort === null ? undefined : (input.effort ?? detail.effort),
		});
		return null;
	},
});

export const remove = mutation({
	args: { id: v.id("activities") },
	returns: v.null(),
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		await requireOwned(ctx, userId, id);
		const detail = await ctx.db
			.query("enduranceActivityDetails")
			.withIndex("by_activity", (q) => q.eq("activityId", id))
			.unique();
		if (detail) await ctx.db.delete(detail._id);
		await ctx.db.delete(id);
		return null;
	},
});
