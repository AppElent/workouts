import { isoDateAt, isoWeekKey, workingVolume } from "@foundry/core";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";
import { exerciseSets } from "./lib/exerciseCatalog";
import { exerciseReference } from "./lib/validators";

/** UTC offsets run from UTC−12:00 to UTC+14:00. */
const MAX_UTC_OFFSET_MINUTES = 14 * 60;

/**
 * Work volume in kg per ISO week, oldest first. Weeks follow the caller's
 * calendar: `utcOffsetMinutes` is minutes east of UTC. Builds older than
 * #194 omit it and get UTC weeks, as the previous server gave them.
 */
export const weeklyVolume = query({
	args: {
		exerciseId: exerciseReference,
		utcOffsetMinutes: v.optional(v.number()),
	},
	returns: v.array(v.object({ week: v.string(), volume: v.number() })),
	handler: async (ctx, { exerciseId, utcOffsetMinutes = 0 }) => {
		const userId = await requireUserId(ctx);
		if (
			!Number.isInteger(utcOffsetMinutes) ||
			Math.abs(utcOffsetMinutes) > MAX_UTC_OFFSET_MINUTES
		)
			throw appError("invalid", "utcOffsetMinutes");
		const weeks = new Map<string, Doc<"sets">[]>();
		for (const set of await exerciseSets(ctx, userId, exerciseId)) {
			const week = isoWeekKey(isoDateAt(set.loggedAt, utcOffsetMinutes));
			const sets = weeks.get(week);
			if (sets) sets.push(set);
			else weeks.set(week, [set]);
		}
		return [...weeks]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([week, sets]) => ({
				week,
				volume: Math.round(workingVolume(sets)),
			}));
	},
});
