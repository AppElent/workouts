import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'
import { calculateOneRepMax } from './lib/oneRepMax'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

export const getCurrentForExercise = query({
  args: { exerciseId: v.id('exercises') },
  handler: async (ctx, { exerciseId }) => {
    const userId = await requireUser(ctx)
    return ctx.db
      .query('oneRepMaxes')
      .withIndex('by_user_exercise', (q) =>
        q.eq('userId', userId).eq('exerciseId', exerciseId),
      )
      .order('desc')
      .first()
  },
})

export const listForExercise = query({
  args: { exerciseId: v.id('exercises') },
  handler: async (ctx, { exerciseId }) => {
    const userId = await requireUser(ctx)
    return ctx.db
      .query('oneRepMaxes')
      .withIndex('by_user_exercise', (q) =>
        q.eq('userId', userId).eq('exerciseId', exerciseId),
      )
      .order('asc')
      .collect()
  },
})

export const addManual = mutation({
  args: {
    exerciseId: v.id('exercises'),
    value: v.number(),
    unit: v.union(v.literal('kg'), v.literal('lbs')),
    date: v.optional(v.number()),
  },
  handler: async (ctx, { exerciseId, value, unit, date }) => {
    const userId = await requireUser(ctx)
    return ctx.db.insert('oneRepMaxes', {
      userId,
      exerciseId,
      value,
      unit,
      date: date ?? Date.now(),
      source: 'manual',
    })
  },
})

export const calculateAndStore = mutation({
  args: {
    exerciseId: v.id('exercises'),
    weight: v.number(),
    reps: v.number(),
    unit: v.union(v.literal('kg'), v.literal('lbs')),
  },
  handler: async (ctx, { exerciseId, weight, reps, unit }) => {
    const userId = await requireUser(ctx)
    const manualOrm = await ctx.db
      .query('oneRepMaxes')
      .withIndex('by_user_exercise', (q) =>
        q.eq('userId', userId).eq('exerciseId', exerciseId),
      )
      .filter((q) => q.eq(q.field('source'), 'manual'))
      .first()
    if (manualOrm) return
    const { value, source, formula } = calculateOneRepMax(weight, reps)
    const current = await ctx.db
      .query('oneRepMaxes')
      .withIndex('by_user_exercise', (q) =>
        q.eq('userId', userId).eq('exerciseId', exerciseId),
      )
      .filter((q) => q.neq(q.field('source'), 'manual'))
      .first()
    if (current && value <= current.value) return
    if (current) await ctx.db.delete(current._id)
    await ctx.db.insert('oneRepMaxes', {
      userId,
      exerciseId,
      value,
      unit,
      date: Date.now(),
      source,
      formula,
    })
  },
})
