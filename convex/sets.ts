import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { QueryCtx, MutationCtx } from './_generated/server'
import { calculateOneRepMax } from './lib/oneRepMax'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

async function recalcOneRepMax(
  ctx: MutationCtx,
  userId: string,
  exerciseId: Id<'exercises'>,
) {
  const manualOrm = await ctx.db
    .query('oneRepMaxes')
    .withIndex('by_user_exercise', (q) =>
      q.eq('userId', userId).eq('exerciseId', exerciseId),
    )
    .filter((q) => q.eq(q.field('source'), 'manual'))
    .first()
  if (manualOrm) return

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
  if (remaining.length === 0) return

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
    if (!manualOrm && args.weight > 0) {
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

export const update = mutation({
  args: {
    id: v.id('sets'),
    reps: v.optional(v.number()),
    weight: v.optional(v.number()),
    unit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
    rpe: v.optional(v.number()),
    setType: v.optional(
      v.union(
        v.literal('warmup'),
        v.literal('working'),
        v.literal('drop'),
        v.literal('failure'),
      ),
    ),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await requireUser(ctx)
    const set = await ctx.db.get(id)
    if (!set || set.userId !== userId) throw new Error('Unauthorized')
    await ctx.db.patch(id, patch)
    await recalcOneRepMax(ctx, userId, set.exerciseId)
  },
})

export const duplicate = mutation({
  args: { id: v.id('sets') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const src = await ctx.db.get(id)
    if (!src || src.userId !== userId) throw new Error('Unauthorized')

    const sessionSets = (
      await ctx.db
        .query('sets')
        .withIndex('by_session_exercise', (q) =>
          q.eq('sessionId', src.sessionId).eq('exerciseId', src.exerciseId),
        )
        .collect()
    ).filter((s) => s.userId === userId)
    const maxNum = sessionSets.reduce(
      (m, s) => (s.setNumber > m ? s.setNumber : m),
      0,
    )

    const newId = await ctx.db.insert('sets', {
      userId,
      sessionId: src.sessionId,
      exerciseId: src.exerciseId,
      setNumber: maxNum + 1,
      reps: src.reps,
      weight: src.weight,
      unit: src.unit,
      rpe: src.rpe,
      setType: src.setType,
      loggedAt: Date.now(),
    })
    await recalcOneRepMax(ctx, userId, src.exerciseId)
    return newId
  },
})

export const getLastForExercise = query({
  args: { exerciseId: v.id('exercises') },
  handler: async (ctx, { exerciseId }) => {
    const userId = await requireUser(ctx)
    return ctx.db
      .query('sets')
      .withIndex('by_exercise', (q) => q.eq('exerciseId', exerciseId))
      .order('desc')
      .filter((q) => q.eq(q.field('userId'), userId))
      .first()
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
    await recalcOneRepMax(ctx, userId, exerciseId)
  },
})
