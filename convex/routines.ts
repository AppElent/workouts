import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx)
    const routines = await ctx.db
      .query('routines')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()
    return Promise.all(
      routines.map(async (routine) => ({
        ...routine,
        exercises: await Promise.all(
          routine.exercises.map(async (ex) => {
            const exercise = await ctx.db.get(ex.exerciseId)
            return { ...ex, exerciseName: exercise?.name ?? 'Unknown' }
          }),
        ),
      })),
    )
  },
})

export const getById = query({
  args: { id: v.id('routines') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const routine = await ctx.db.get(id)
    if (!routine || routine.userId !== userId) return null
    return routine
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    exercises: v.array(
      v.object({
        exerciseId: v.id('exercises'),
        defaultSets: v.number(),
        defaultReps: v.number(),
        defaultWeight: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    return ctx.db.insert('routines', { ...args, userId })
  },
})

export const remove = mutation({
  args: { id: v.id('routines') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const routine = await ctx.db.get(id)
    if (!routine || routine.userId !== userId) throw new Error('Unauthorized')
    await ctx.db.delete(id)
  },
})

export const update = mutation({
  args: {
    id: v.id('routines'),
    name: v.string(),
    exercises: v.array(
      v.object({
        exerciseId: v.id('exercises'),
        defaultSets: v.number(),
        defaultReps: v.number(),
        defaultWeight: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const routine = await ctx.db.get(args.id)
    if (!routine || routine.userId !== userId) throw new Error('Unauthorized')
    await ctx.db.patch(args.id, {
      name: args.name,
      exercises: args.exercises,
    })
  },
})

export const startSession = mutation({
  args: { routineId: v.id('routines') },
  handler: async (ctx, { routineId }) => {
    const userId = await requireUser(ctx)
    const routine = await ctx.db.get(routineId)
    if (!routine || routine.userId !== userId)
      throw new Error('Routine not found.')
    const existing = await ctx.db
      .query('workoutSessions')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', userId).eq('status', 'active'),
      )
      .first()
    if (existing) throw new Error('A session is already active.')
    const now = Date.now()
    const sessionId = await ctx.db.insert('workoutSessions', {
      userId,
      date: now,
      startTime: now,
      name: routine.name,
      routineId,
      status: 'active',
    })
    for (const ex of routine.exercises) {
      for (let s = 1; s <= ex.defaultSets; s++) {
        await ctx.db.insert('sets', {
          userId,
          sessionId,
          exerciseId: ex.exerciseId,
          setNumber: s,
          reps: ex.defaultReps,
          weight: ex.defaultWeight ?? 0,
          unit: 'kg',
          setType: 'working',
          loggedAt: now,
        })
      }
    }
    return sessionId
  },
})
