import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'
import { recalcOneRepMax } from "./sets"
import { exerciseReference, normalizeExerciseReferences } from "./lib/exerciseCatalog"
import { ensureSessionExercise } from "./lib/strengthSession"

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
    return { ...session, exercises: session.exercises ? await normalizeExerciseReferences(ctx, session.exercises) : undefined }
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
      exercises: [],
      status: 'active',
    })
  },
})

export const addExercise = mutation({
  args: { sessionId: v.id('workoutSessions'), exerciseId: exerciseReference },
  handler: async (ctx, { sessionId, exerciseId }) => {
    const userId = await requireUser(ctx)
    return ensureSessionExercise(ctx, userId, sessionId, exerciseId)
  },
})

export const finish = mutation({
  args: { id: v.id('workoutSessions'), discardUnfinished: v.optional(v.boolean()) },
  handler: async (ctx, { id, discardUnfinished }) => {
    const userId = await requireUser(ctx)
    const session = await ctx.db.get(id)
    if (!session || session.userId !== userId) throw new Error('Unauthorized')
    if (session.status === 'completed') return
    if (session.status !== 'active') throw new Error('This session has ended.')
    const sets = await ctx.db.query('sets').withIndex('by_session', q => q.eq('sessionId', id)).collect()
    const wod = await ctx.db.query('wodResults').withIndex('by_session', q => q.eq('sessionId', id)).first()
    if (sets.length === 0 && !wod) throw new Error('Discard the empty session instead of completing it.')
    const unfinished = session.exercises?.some(exercise => sets.filter(set => set.exerciseId === exercise.exerciseId).length < exercise.plannedSets.length)
    if (unfinished && !discardUnfinished) throw new Error('Confirm leaving unfinished targets before finishing.')
    await ctx.db.patch(id, { status: 'completed', endTime: Date.now() })
  },
})

export const cancel = mutation({
  args: { id: v.id('workoutSessions') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const session = await ctx.db.get(id)
    if (!session || session.userId !== userId) throw new Error('Unauthorized')
    if (session.status === 'cancelled') return
    if (session.status !== 'active') throw new Error('This session has ended.')
    await ctx.db.patch(id, { status: 'cancelled', endTime: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id('workoutSessions') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const session = await ctx.db.get(id)
    if (!session || session.userId !== userId) throw new Error('Unauthorized')
    const sessionWodResults = await ctx.db
      .query('wodResults')
      .withIndex('by_session', (q) => q.eq('sessionId', id))
      .collect()
    for (const r of sessionWodResults) {
      if (r.userId === userId) await ctx.db.delete(r._id)
    }
    const sets = await ctx.db
      .query('sets')
      .withIndex('by_session', (q) => q.eq('sessionId', id))
      .collect()
    const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))]
    for (const set of sets) {
      await ctx.db.delete(set._id)
    }
    for (const exerciseId of exerciseIds) {
      await recalcOneRepMax(ctx, userId, exerciseId)
    }
    await ctx.db.delete(id)
  },
})
