import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'
import { calculateOneRepMax } from './lib/oneRepMax'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return ctx.db
      .query('workoutSessions')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', identity.subject).eq('status', 'active'),
      )
      .first()
  },
})

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 5 }) => {
    const userId = await requireUser(ctx)
    const safeLimit = Math.min(limit, 50)
    return ctx.db
      .query('workoutSessions')
      .withIndex('by_user_date', (q) => q.eq('userId', userId))
      .order('desc')
      .take(safeLimit)
  },
})

export const getById = query({
  args: { id: v.id('workoutSessions') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const session = await ctx.db.get(id)
    if (!session || session.userId !== userId) return null
    return session
  },
})

export const create = mutation({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, { name }) => {
    const userId = await requireUser(ctx)
    const existing = await ctx.db
      .query('workoutSessions')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', userId).eq('status', 'active'),
      )
      .first()
    if (existing) throw new Error('A session is already active.')
    const now = Date.now()
    return ctx.db.insert('workoutSessions', {
      userId,
      date: now,
      startTime: now,
      name,
      status: 'active',
    })
  },
})

export const finish = mutation({
  args: { id: v.id('workoutSessions') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const session = await ctx.db.get(id)
    if (!session || session.userId !== userId) throw new Error('Unauthorized')
    await ctx.db.patch(id, { status: 'completed', endTime: Date.now() })
  },
})

export const cancel = mutation({
  args: { id: v.id('workoutSessions') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const session = await ctx.db.get(id)
    if (!session || session.userId !== userId) throw new Error('Unauthorized')
    await ctx.db.patch(id, { status: 'cancelled' })
  },
})

export const remove = mutation({
  args: { id: v.id('workoutSessions') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const session = await ctx.db.get(id)
    if (!session || session.userId !== userId) throw new Error('Unauthorized')
    const sets = await ctx.db
      .query('sets')
      .withIndex('by_session', (q) => q.eq('sessionId', id))
      .collect()
    const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))]
    for (const set of sets) {
      await ctx.db.delete(set._id)
    }
    for (const exerciseId of exerciseIds) {
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
    }
    await ctx.db.delete(id)
  },
})
