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
    const identity = await ctx.auth.getUserIdentity()
    const defaults = await ctx.db
      .query('exercises')
      .withIndex('by_default', (q) => q.eq('isDefault', true))
      .collect()
    if (!identity) return defaults
    const userExercises = await ctx.db
      .query('exercises')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect()
    return [...defaults, ...userExercises].sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  },
})

export const getById = query({
  args: { id: v.id('exercises') },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity()
    const exercise = await ctx.db.get(id)
    if (!exercise) return null
    if (exercise.isDefault) return exercise
    if (!identity || exercise.userId !== identity.subject) return null
    return exercise
  },
})

export const getHistory = query({
  args: { exerciseId: v.id('exercises') },
  handler: async (ctx, { exerciseId: id }) => {
    const userId = await requireUser(ctx)
    const sets = await ctx.db
      .query('sets')
      .withIndex('by_exercise', (q) => q.eq('exerciseId', id))
      .collect()
    const userSets = sets.filter((s) => s.userId === userId)
    const result = []
    for (const set of userSets) {
      const session = await ctx.db.get(set.sessionId)
      result.push({
        ...set,
        sessionDate: session?.date ?? set.loggedAt,
        sessionName: session?.name ?? null,
      })
    }
    return result.sort((a, b) => a.loggedAt - b.loggedAt)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    muscleGroups: v.array(v.string()),
    category: v.union(v.literal('compound'), v.literal('isolation')),
    equipment: v.union(
      v.literal('barbell'),
      v.literal('dumbbell'),
      v.literal('cable'),
      v.literal('bodyweight'),
      v.literal('machine'),
      v.literal('kettlebell'),
      v.literal('band'),
      v.literal('other'),
    ),
    notes: v.optional(v.string()),
    weightIncrement: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    return ctx.db.insert('exercises', { ...args, isDefault: false, userId })
  },
})

export const remove = mutation({
  args: { id: v.id('exercises') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const exercise = await ctx.db.get(id)
    if (!exercise) throw new Error('Exercise not found')
    if (exercise.isDefault) throw new Error('Cannot delete default exercises')
    if (exercise.userId !== userId) throw new Error('Unauthorized')
    const sets = await ctx.db
      .query('sets')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('exerciseId'), id))
      .collect()
    for (const set of sets) {
      await ctx.db.delete(set._id)
    }
    const orms = await ctx.db
      .query('oneRepMaxes')
      .withIndex('by_user_exercise', (q) =>
        q.eq('userId', userId).eq('exerciseId', id),
      )
      .collect()
    for (const orm of orms) {
      await ctx.db.delete(orm._id)
    }
    await ctx.db.delete(id)
  },
})
