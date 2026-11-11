/**
 * Whether a *completed* workout session or endurance Activity falls inside a
 * local-day range: the only link between Activity and Nutrition.
 *
 * It returns a bare boolean and never duration, intensity, calories or training
 * load, so no client can derive expenditure or an energy balance from it. The
 * day view shows it as a decorative marker; it never factors into Nutrition
 * Goals or totals.
 *
 * `from`/`to` are epoch-ms bounds of one local calendar day. The server does
 * not know the device's timezone, so the caller computes them.
 */
import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";

function assertRange(from: number, to: number) {
	if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || !(from < to))
		throw appError("invalid", "days");
}

async function completedIn(
	ctx: QueryCtx,
	userId: string,
	from: number,
	to: number,
) {
	const strength = await ctx.db
		.query("workoutSessions")
		.withIndex("by_user_status_date", (q) =>
			q
				.eq("userId", userId)
				.eq("status", "completed")
				.gte("date", from)
				.lt("date", to),
		)
		.first();
	if (strength) return true;
	const endurance = await ctx.db
		.query("activities")
		.withIndex("by_user_occurred_at", (q) =>
			q.eq("userId", userId).gte("occurredAt", from).lt("occurredAt", to),
		)
		.first();
	return endurance !== null;
}

/**
 * Whether each local day of the diary week strip (at most 31) holds a
 * completed activity, in the order given. Still only booleans: nothing about what was trained.
 */
export const completedActivityDays = query({
	args: { days: v.array(v.object({ from: v.number(), to: v.number() })) },
	returns: v.array(v.boolean()),
	handler: async (ctx, { days }) => {
		const userId = await requireUserId(ctx);
		if (days.length > 31) throw appError("tooLarge", "days");
		for (const { from, to } of days) assertRange(from, to);
		return Promise.all(
			days.map(({ from, to }) => completedIn(ctx, userId, from, to)),
		);
	},
});
