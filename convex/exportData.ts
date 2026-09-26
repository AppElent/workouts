import { resolveExercise } from "./lib/exerciseCatalog";
import { query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import { v } from 'convex/values'

const activityExport = v.object({
	_id: v.id('activities'),
	_creationTime: v.number(),
	userId: v.string(),
	clientEntryId: v.string(),
	sport: v.union(v.literal('running'), v.literal('cycling')),
	occurredAt: v.number(),
	durationSeconds: v.number(),
	title: v.optional(v.string()),
	notes: v.optional(v.string()),
	createdAt: v.number(),
	updatedAt: v.number(),
})

const enduranceDetailExport = v.object({
	_id: v.id('enduranceActivityDetails'),
	_creationTime: v.number(),
	activityId: v.id('activities'),
	userId: v.string(),
	distanceMeters: v.number(),
	environment: v.optional(v.union(v.literal('indoor'), v.literal('outdoor'))),
	elevationGainMeters: v.optional(v.number()),
	averageHeartRate: v.optional(v.number()),
	effort: v.optional(v.number()),
})

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
            ...routines.flatMap((routine) => routine.exercises.map((exercise) => exercise.exerciseId)),
		])
		const exercises: { _id: string; name: string }[] = []
		for (const id of exerciseIds) {
			const ex = await resolveExercise(ctx, id, userId)
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

// The JSON exporter drains these pages and attaches both arrays to the legacy
// allData payload. Each page remains bounded even after years of activities.
export const endurancePage = query({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.object({
		activities: v.array(activityExport),
		enduranceActivityDetails: v.array(enduranceDetailExport),
		cursor: v.union(v.string(), v.null()),
		isDone: v.boolean(),
	}),
	handler: async (ctx, { cursor }) => {
		const userId = await requireUser(ctx)
		const page = await ctx.db.query('activities')
			.withIndex('by_user_occurred_at', (q) => q.eq('userId', userId))
			.order('asc')
			.paginate({ cursor: cursor ?? null, numItems: 100 })
		const enduranceActivityDetails = await Promise.all(page.page.map(async (activity) => {
			const detail = await ctx.db.query('enduranceActivityDetails')
				.withIndex('by_activity', (q) => q.eq('activityId', activity._id))
				.unique()
			if (!detail || detail.userId !== userId) throw new Error('Activity details are missing.')
			return detail
		}))
		return {
			activities: page.page,
			enduranceActivityDetails,
			cursor: page.isDone ? null : page.continueCursor,
			isDone: page.isDone,
		}
	},
})
