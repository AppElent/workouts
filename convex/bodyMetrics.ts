import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { assertOptionalRange } from './lib/validate'

async function requireUser(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity()
	if (!identity) throw new Error('Unauthenticated')
	return identity.subject
}

const measurementsValidator = v.optional(
	v.object({
		chest: v.optional(v.number()),
		waist: v.optional(v.number()),
		arms: v.optional(v.number()),
		thighs: v.optional(v.number()),
	}),
)

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUser(ctx)
		return ctx.db
			.query('bodyMetrics')
			.withIndex('by_user_date', (q) => q.eq('userId', userId))
			.order('desc')
			.collect()
	},
})

export const latest = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUser(ctx)
		return ctx.db
			.query('bodyMetrics')
			.withIndex('by_user_date', (q) => q.eq('userId', userId))
			.order('desc')
			.first()
	},
})

export const add = mutation({
	args: {
		date: v.optional(v.number()),
		weight: v.optional(v.number()),
		unit: v.union(v.literal('kg'), v.literal('lbs')),
		bodyFatPct: v.optional(v.number()),
		measurements: measurementsValidator,
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx)
		assertOptionalRange(args.weight, 1, 1000, 'Weight')
		assertOptionalRange(args.bodyFatPct, 1, 75, 'Body fat %')
		assertOptionalRange(args.measurements?.chest, 1, 300, 'Chest')
		assertOptionalRange(args.measurements?.waist, 1, 300, 'Waist')
		assertOptionalRange(args.measurements?.arms, 1, 150, 'Arms')
		assertOptionalRange(args.measurements?.thighs, 1, 200, 'Thighs')
		if (
			args.weight === undefined &&
			args.bodyFatPct === undefined &&
			!args.measurements
		) {
			throw new Error('Enter at least one measurement.')
		}
		return ctx.db.insert('bodyMetrics', {
			userId,
			date: args.date ?? Date.now(),
			weight: args.weight,
			unit: args.unit,
			bodyFatPct: args.bodyFatPct,
			measurements: args.measurements,
			notes: args.notes,
		})
	},
})

export const remove = mutation({
	args: { id: v.id('bodyMetrics') },
	handler: async (ctx, { id }) => {
		const userId = await requireUser(ctx)
		const entry = await ctx.db.get(id)
		if (!entry || entry.userId !== userId) throw new Error('Unauthorized')
		await ctx.db.delete(id)
	},
})
