import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'
import { calculateOneRepMax } from './lib/oneRepMax'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

export const listForSession = query({
  args: { sessionId: v.id('workoutSessions') },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUser(ctx)
    const sets = await ctx.db
      .query('sets')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .collect()
    return sets.filter((s) => s.userId === userId)
  },
})

export const add = mutation({
  args: {
    sessionId: v.id('workoutSessions'),
    exerciseId: v.id('exercises'),
    setNumber: v.number(),
    reps: v.number(),
    weight: v.number(),
    unit: v.union(v.literal('kg'), v.literal('lbs')),
    rpe: v.optional(v.number()),
    setType: v.union(
      v.literal('warmup'),
      v.literal('working'),
      v.literal('drop'),
      v.literal('failure'),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userId !== userId) throw new Error('Unauthorized')
    const setId = await ctx.db.insert('sets', {
      ...args,
      userId,
      loggedAt: Date.now(),
    })
    const manualOrm = await ctx.db
      .query('oneRepMaxes')
      .withIndex('by_user_exercise', (q) =>
        q.eq('userId', userId).eq('exerciseId', args.exerciseId),
      )
      .filter((q) => q.eq(q.field('source'), 'manual'))
      .first()
    if (!manualOrm) {
      const { value, source, formula } = calculateOneRepMax(
        args.weight,
        args.reps,
      )
      const current = await ctx.db
        .query('oneRepMaxes')
        .withIndex('by_user_exercise', (q) =>
          q.eq('userId', userId).eq('exerciseId', args.exerciseId),
        )
        .filter((q) => q.neq(q.field('source'), 'manual'))
        .first()
      if (!current || value > current.value) {
        if (current) await ctx.db.delete(current._id)
        await ctx.db.insert('oneRepMaxes', {
          userId,
          exerciseId: args.exerciseId,
          value,
          unit: args.unit,
          date: Date.now(),
          source,
          formula,
        })
      }
    }
    return setId
  },
})

export const remove = mutation({
  args: { id: v.id('sets') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const set = await ctx.db.get(id)
    if (!set || set.userId !== userId) throw new Error('Unauthorized')
    const exerciseId = set.exerciseId
    await ctx.db.delete(id)
    const staleOrms = await ctx.db
      .query('oneRepMaxes')
      .withIndex('by_user_exercise', (q) =>
        q.eq('userId', userId).eq('exerciseId', exerciseId),
      )
      .filter((q) => q.neq(q.field('source'), 'manual'))
      .collect()
    for (const orm of staleOrms) await ctx.db.delete(orm._id)
    const remaining = (
      await ctx.db
        .query('sets')
        .withIndex('by_exercise', (q) => q.eq('exerciseId', exerciseId))
        .collect()
    ).filter((s) => s.userId === userId && s.weight > 0)
    if (remaining.length > 0) {
      let bestValue = 0
      let bestSet = remaining[0]
      for (const s of remaining) {
        const { value } = calculateOneRepMax(s.weight, s.reps)
        if (value > bestValue) {
          bestValue = value
          bestSet = s
        }
      }
      const { value, source, formula } = calculateOneRepMax(
        bestSet.weight,
        bestSet.reps,
      )
      await ctx.db.insert('oneRepMaxes', {
        userId,
        exerciseId,
        value,
        unit: bestSet.unit,
        date: Date.now(),
        source,
        formula,
      })
    }
  },
})
