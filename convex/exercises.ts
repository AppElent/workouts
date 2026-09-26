import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { mergeExerciseCatalog } from "@workouts/core/exercises";
import { exerciseSets, exerciseDocument, exerciseReference, resolveExercise } from "./lib/exerciseCatalog";
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

// Compatibility for older clients. Current clients merge the bundle locally.
export const list = query({
  args: {},
  returns: v.array(v.object({ ...exerciseDocument.fields, _id: exerciseReference })),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return mergeExerciseCatalog([])
    const userExercises = await ctx.db
      .query('exercises')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect()
    return mergeExerciseCatalog(userExercises)
  },
})

// New clients download only personal exercises.
export const listPersonal = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(exerciseDocument),
  handler: async (ctx, { paginationOpts }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { page: [], isDone: true, continueCursor: "" }
    return ctx.db.query('exercises').withIndex('by_user', (q) => q.eq('userId', identity.subject)).paginate(paginationOpts)
  },
})

export const getById = query({
  args: { id: exerciseReference },
  returns: v.union(v.null(), v.object({ ...exerciseDocument.fields, _id: exerciseReference })),
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity()
    return resolveExercise(ctx, id, identity?.subject)
  },
})

export const getHistory = query({
  args: { exerciseId: exerciseReference },
  handler: async (ctx, { exerciseId }) => {
    const userId = await requireUser(ctx)
    const userSets = await exerciseSets(ctx, userId, exerciseId)
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
  args: { id: exerciseReference },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const documentId = ctx.db.normalizeId('exercises', id)
    if (!documentId) throw new Error('Cannot delete a shipped exercise')
    const exercise = await ctx.db.get(documentId)
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
    await ctx.db.delete(documentId)
  },
})
