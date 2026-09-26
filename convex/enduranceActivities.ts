import { validateEnduranceInput } from "@workouts/core";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const sport = v.union(v.literal("running"), v.literal("cycling"));
const environment = v.union(v.literal("indoor"), v.literal("outdoor"));

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

async function requireUser(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthenticated");
	return identity.subject;
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
		const userId = await requireUser(ctx);
		if (!args.clientEntryId.trim() || args.clientEntryId.length > 200) throw new Error("Invalid client entry ID.");
		validateEnduranceInput(args);
		const existing = await ctx.db
			.query("activities")
			.withIndex("by_user_client_entry", (q) => q.eq("userId", userId).eq("clientEntryId", args.clientEntryId))
			.unique();
		if (existing) {
			const saved = await ctx.db.query("enduranceActivityDetails").withIndex("by_activity", (q) => q.eq("activityId", existing._id)).unique();
			if (!saved) throw new Error("Activity details are missing.");
			const matches = existing.sport === args.sport && existing.occurredAt === args.occurredAt && existing.durationSeconds === args.durationSeconds
				&& existing.title === args.title && existing.notes === args.notes && saved.distanceMeters === args.distanceMeters
				&& saved.environment === args.environment && saved.elevationGainMeters === args.elevationGainMeters
				&& saved.averageHeartRate === args.averageHeartRate && saved.effort === args.effort;
			if (!matches) throw new Error("Activity already exists with different details.");
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
		const userId = await requireUser(ctx);
		const activity = await ctx.db.get(id);
		if (!activity || activity.userId !== userId) return null;
		const detail = await ctx.db.query("enduranceActivityDetails").withIndex("by_activity", (q) => q.eq("activityId", id)).unique();
		if (!detail) throw new Error("Activity details are missing.");
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
		const userId = await requireUser(ctx);
		const activity = await ctx.db.get(id);
		if (!activity || activity.userId !== userId) throw new Error("Activity not found.");
		validateEnduranceInput(input);
		const detail = await ctx.db.query("enduranceActivityDetails").withIndex("by_activity", (q) => q.eq("activityId", id)).unique();
		if (!detail) throw new Error("Activity details are missing.");
		await ctx.db.patch(id, {
			occurredAt: input.occurredAt,
			durationSeconds: input.durationSeconds,
			title: input.title === null ? undefined : input.title ?? activity.title,
			notes: input.notes === null ? undefined : input.notes ?? activity.notes,
			updatedAt: Date.now(),
		});
		await ctx.db.patch(detail._id, {
			distanceMeters: input.distanceMeters,
			environment: input.environment === null ? undefined : input.environment ?? detail.environment,
			elevationGainMeters: input.elevationGainMeters === null ? undefined : input.elevationGainMeters ?? detail.elevationGainMeters,
			averageHeartRate: input.averageHeartRate === null ? undefined : input.averageHeartRate ?? detail.averageHeartRate,
			effort: input.effort === null ? undefined : input.effort ?? detail.effort,
		});
		return null;
	},
});

export const remove = mutation({
	args: { id: v.id("activities") },
	returns: v.null(),
	handler: async (ctx, { id }) => {
		const userId = await requireUser(ctx);
		const activity = await ctx.db.get(id);
		if (!activity || activity.userId !== userId) throw new Error("Activity not found.");
		const detail = await ctx.db.query("enduranceActivityDetails").withIndex("by_activity", (q) => q.eq("activityId", id)).unique();
		if (detail) await ctx.db.delete(detail._id);
		await ctx.db.delete(id);
		return null;
	},
});
