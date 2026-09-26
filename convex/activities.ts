import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const activitySport = v.union(v.literal("strength"), v.literal("running"), v.literal("cycling"));
const summaryValidator = v.object({
	id: v.string(),
	sport: activitySport,
	occurredAt: v.number(),
	durationSeconds: v.number(),
	title: v.optional(v.string()),
	distanceMeters: v.optional(v.number()),
});

type Entry = {
	id: string;
	sport: "strength" | "running" | "cycling";
	occurredAt: number;
	durationSeconds: number;
	title?: string;
	distanceMeters?: number;
	creationTime: number;
};

type SourceKey = { at: number; creationTime: number };
type PageState = { userId: string; strength: SourceKey | null; endurance: SourceKey | null; sport?: string; from?: number; to?: number };

function compareEntries(a: Entry, b: Entry) {
	return b.occurredAt - a.occurredAt || b.creationTime - a.creationTime || b.id.localeCompare(a.id);
}

function validKey(key: unknown): key is SourceKey | null {
	return key === null || (typeof key === "object" && key !== null &&
		"at" in key && typeof key.at === "number" && Number.isSafeInteger(key.at) && key.at >= 0 &&
		"creationTime" in key && typeof key.creationTime === "number" && Number.isFinite(key.creationTime) && key.creationTime >= 0);
}

function decodeCursor(cursor: string | null | undefined, userId: string, sport: string | undefined, from: number | undefined, to: number | undefined): PageState {
	if (!cursor) return { userId, strength: null, endurance: null, sport, from, to };
	let parsed: unknown;
	try { parsed = JSON.parse(cursor); } catch { throw new Error("Invalid history cursor."); }
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Invalid history cursor.");
	const state = parsed as PageState;
	if (state.userId !== userId || state.sport !== sport || state.from !== from || state.to !== to || !validKey(state.strength) || !validKey(state.endurance) ||
		(state.strength !== null && ((from !== undefined && state.strength.at < from) || (to !== undefined && state.strength.at >= to))) ||
		(state.endurance !== null && ((from !== undefined && state.endurance.at < from) || (to !== undefined && state.endurance.at >= to)))) {
		throw new Error("History cursor does not match the filter.");
	}
	return state;
}

async function fetchStrength(ctx: QueryCtx, userId: string, key: SourceKey | null, from: number | undefined, to: number | undefined, limit: number): Promise<Entry[]> {
	const same = key ? await ctx.db.query("workoutSessions")
		.withIndex("by_user_status_date", (q) => q.eq("userId", userId).eq("status", "completed").eq("date", key.at).lt("_creationTime", key.creationTime))
		.order("desc").take(limit) : [];
	const older = same.length < limit ? await ctx.db.query("workoutSessions")
		.withIndex("by_user_status_date", (q) => {
			const base = q.eq("userId", userId).eq("status", "completed");
			const upper = key ? key.at : to;
			if (from !== undefined && upper !== undefined) return base.gte("date", from).lt("date", upper);
			if (from !== undefined) return base.gte("date", from);
			if (upper !== undefined) return base.lt("date", upper);
			return base;
		})
		.order("desc").take(limit - same.length) : [];
	const rows = [...same, ...older];
	return rows.map((session: Doc<"workoutSessions">) => ({
		id: session._id,
		sport: "strength" as const,
		occurredAt: session.date,
		durationSeconds: session.endTime === undefined ? 0 : Math.max(0, (session.endTime - session.startTime) / 1000),
		title: session.name,
		creationTime: session._creationTime,
	}));
}

async function fetchEndurance(ctx: QueryCtx, userId: string, sport: "running" | "cycling" | undefined, key: SourceKey | null, from: number | undefined, to: number | undefined, limit: number): Promise<Entry[]> {
	const same = key ? await (sport
		? ctx.db.query("activities").withIndex("by_user_sport_occurred_at", (q) => q.eq("userId", userId).eq("sport", sport).eq("occurredAt", key.at).lt("_creationTime", key.creationTime))
		: ctx.db.query("activities").withIndex("by_user_occurred_at", (q) => q.eq("userId", userId).eq("occurredAt", key.at).lt("_creationTime", key.creationTime)))
		.order("desc").take(limit) : [];
	const queryBase = sport
		? ctx.db.query("activities").withIndex("by_user_sport_occurred_at", (q) => {
			const base = q.eq("userId", userId).eq("sport", sport);
			const upper = key ? key.at : to;
			if (from !== undefined && upper !== undefined) return base.gte("occurredAt", from).lt("occurredAt", upper);
			if (from !== undefined) return base.gte("occurredAt", from);
			if (upper !== undefined) return base.lt("occurredAt", upper);
			return base;
		})
		: ctx.db.query("activities").withIndex("by_user_occurred_at", (q) => {
			const base = q.eq("userId", userId);
			const upper = key ? key.at : to;
			if (from !== undefined && upper !== undefined) return base.gte("occurredAt", from).lt("occurredAt", upper);
			if (from !== undefined) return base.gte("occurredAt", from);
			if (upper !== undefined) return base.lt("occurredAt", upper);
			return base;
		});
	const older = same.length < limit ? await queryBase.order("desc").take(limit - same.length) : [];
	const rows = [...same, ...older];
	return Promise.all(rows.map(async (activity: Doc<"activities">) => {
		const details = await ctx.db.query("enduranceActivityDetails").withIndex("by_activity", (q) => q.eq("activityId", activity._id)).unique();
		if (!details) throw new Error("Activity details are missing.");
		return {
			id: activity._id,
			sport: activity.sport,
			occurredAt: activity.occurredAt,
			durationSeconds: activity.durationSeconds,
			title: activity.title,
			distanceMeters: details.distanceMeters,
			creationTime: activity._creationTime,
		};
	}));
}

export const list = query({
	args: {
		sport: v.optional(activitySport),
		from: v.optional(v.number()),
		to: v.optional(v.number()),
		cursor: v.optional(v.union(v.string(), v.null())),
		limit: v.optional(v.number()),
	},
	returns: v.object({ items: v.array(summaryValidator), cursor: v.union(v.string(), v.null()), isDone: v.boolean() }),
	handler: async (ctx, { sport, from, to, cursor, limit = 20 }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthenticated");
		if ((from !== undefined && !Number.isSafeInteger(from)) || (to !== undefined && !Number.isSafeInteger(to)) || (from !== undefined && to !== undefined && from >= to)) throw new Error("Invalid history range.");
		if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("History page size must be between 1 and 100.");
		const state = decodeCursor(cursor, identity.subject, sport, from, to);
		const [strength, endurance] = await Promise.all([
			sport === "running" || sport === "cycling" ? Promise.resolve([]) : fetchStrength(ctx, identity.subject, state.strength, from, to, limit),
			sport === "strength" ? Promise.resolve([]) : fetchEndurance(ctx, identity.subject, sport, state.endurance, from, to, limit),
		]);
		const items: Entry[] = [];
		let strengthIndex = 0;
		let enduranceIndex = 0;
		while (items.length < limit) {
			const nextStrength = strength[strengthIndex];
			const nextEndurance = endurance[enduranceIndex];
			if (!nextStrength && !nextEndurance) break;
			if (nextStrength && (!nextEndurance || compareEntries(nextStrength, nextEndurance) <= 0)) {
				items.push(nextStrength);
				state.strength = { at: nextStrength.occurredAt, creationTime: nextStrength.creationTime };
				strengthIndex++;
			} else if (nextEndurance) {
				items.push(nextEndurance);
				state.endurance = { at: nextEndurance.occurredAt, creationTime: nextEndurance.creationTime };
				enduranceIndex++;
			}
		}
		const isDone = strengthIndex === strength.length && enduranceIndex === endurance.length && strength.length < limit && endurance.length < limit;
		return {
			items: items.map(({ creationTime: _creationTime, ...entry }) => entry),
			cursor: isDone ? null : JSON.stringify(state),
			isDone,
		};
	},
});
