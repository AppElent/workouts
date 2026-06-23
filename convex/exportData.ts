import { query } from './_generated/server'
import type { QueryCtx } from './_generated/server'

async function requireUser(ctx: QueryCtx) {
	const identity = await ctx.auth.getUserIdentity()
	if (!identity) throw new Error('Unauthenticated')
	return identity.subject
}

// Returns the full export payload for the signed-in user. Used by the
// Account → Export feature to download a JSON backup and a CSV of all sets.
export const allData = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUser(ctx)

		const [sessions, sets, oneRepMaxes, routines, bodyMetrics, wodResults] =
			await Promise.all([
				ctx.db
					.query('workoutSessions')
					.withIndex('by_user', (q) => q.eq('userId', userId))
					.collect(),
				ctx.db
					.query('sets')
					.withIndex('by_user', (q) => q.eq('userId', userId))
					.collect(),
				ctx.db
					.query('oneRepMaxes')
					.withIndex('by_user', (q) => q.eq('userId', userId))
					.collect(),
				ctx.db
					.query('routines')
					.withIndex('by_user', (q) => q.eq('userId', userId))
					.collect(),
				ctx.db
					.query('bodyMetrics')
					.withIndex('by_user', (q) => q.eq('userId', userId))
					.collect(),
				ctx.db
					.query('wodResults')
					.withIndex('by_user', (q) => q.eq('userId', userId))
					.collect(),
			])

		// Exercise names referenced by the user's sets, so the export is readable.
		const exerciseIds = new Set([
			...sets.map((s) => s.exerciseId as string),
			...oneRepMaxes.map((o) => o.exerciseId as string),
		])
		const exercises: { _id: string; name: string }[] = []
		for (const id of exerciseIds) {
			const ex = await ctx.db.get(id as (typeof sets)[number]['exerciseId'])
			if (ex) exercises.push({ _id: ex._id as string, name: ex.name })
		}

		return {
			exportedAt: Date.now(),
			sessions,
			sets,
			oneRepMaxes,
			routines,
			bodyMetrics,
			wodResults,
			exercises,
		}
	},
})
