/**
 * The only v1 connection between Activity and Nutrition (ticket #78 of spec
 * #68): whether a *completed* workout session falls inside a local-day range.
 *
 * This module only reads completed Strength Sessions and endurance Activities,
 * and returns a bare boolean. It deliberately never returns duration, intensity,
 * calories, or training load — there is nothing here a mobile client could
 * use to compute expenditure or an energy-balance figure, even by accident.
 * The day view renders this as a purely decorative marker; it must never
 * factor into Nutrition Goals or totals.
 *
 * `from`/`to` are epoch-ms bounds of one local calendar day. The server has no
 * notion of the device's timezone, so the caller computes the local-midnight
 * boundaries (see `apps/mobile/src/data/calendar-day.ts`) and passes them in.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

async function requireUser(ctx: QueryCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthenticated");
	return identity.subject;
}

export const hasCompletedActivity = query({
	args: { from: v.number(), to: v.number() },
	returns: v.boolean(),
	handler: async (ctx, { from, to }) => {
		const userId = await requireUser(ctx);
		if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || !(from < to)) throw new Error("Invalid range.");
		const strength = await ctx.db
			.query("workoutSessions")
			.withIndex("by_user_status_date", (q) =>
				q.eq("userId", userId).eq("status", "completed").gte("date", from).lt("date", to),
			)
			.first();
		if (strength) return true;
		const endurance = await ctx.db.query("activities")
			.withIndex("by_user_occurred_at", (q) => q.eq("userId", userId).gte("occurredAt", from).lt("occurredAt", to))
			.first();
		return endurance !== null;
	},
});
