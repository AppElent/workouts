import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'
import { bestScore } from './lib/wodScore'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

const scoreFields = {
  rxScaled: v.union(v.literal('rx'), v.literal('scaled')),
  timeSeconds: v.optional(v.number()),
  rounds: v.optional(v.number()),
  reps: v.optional(v.number()),
  timeCapped: v.optional(v.boolean()),
  load: v.optional(v.number()),
  loadUnit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
  notes: v.optional(v.string()),
}

export const log = mutation({
  args: {
    wodId: v.id('wods'),
    sessionId: v.optional(v.id('workoutSessions')),
    date: v.optional(v.number()),
    ...scoreFields,
  },
  handler: async (ctx, { wodId, sessionId, date, ...score }) => {
    const userId = await requireUser(ctx)
    const wod = await ctx.db.get(wodId)
    if (!wod) throw new Error('WOD not found')
    if (!wod.isDefault && wod.userId !== userId) throw new Error('Unauthorized')
    if (sessionId) {
      const session = await ctx.db.get(sessionId)
      if (!session || session.userId !== userId)
        throw new Error('Session not found')
    }
    return ctx.db.insert('wodResults', {
      userId,
      wodId,
      sessionId,
      date: date ?? Date.now(),
      ...score,
    })
  },
})

export const listForWod = query({
  args: { wodId: v.id('wods') },
  handler: async (ctx, { wodId }) => {
    const userId = await requireUser(ctx)
    const results = await ctx.db
      .query('wodResults')
      .withIndex('by_user_wod', (q) => q.eq('userId', userId).eq('wodId', wodId))
      .collect()
    return results.sort((a, b) => a.date - b.date)
  },
})

export const listForSession = query({
  args: { sessionId: v.id('workoutSessions') },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUser(ctx)
    const results = await ctx.db
      .query('wodResults')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .collect()
    return results.filter((r) => r.userId === userId)
  },
})

export const getBest = query({
  args: { wodId: v.id('wods') },
  handler: async (ctx, { wodId }) => {
    const userId = await requireUser(ctx)
    const wod = await ctx.db.get(wodId)
    if (!wod) return null
    const results = await ctx.db
      .query('wodResults')
      .withIndex('by_user_wod', (q) => q.eq('userId', userId).eq('wodId', wodId))
      .collect()
    return bestScore(wod.type, results)
  },
})

export const remove = mutation({
  args: { id: v.id('wodResults') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const result = await ctx.db.get(id)
    if (!result || result.userId !== userId) throw new Error('Unauthorized')
    await ctx.db.delete(id)
  },
})
