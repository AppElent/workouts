import { assertIntegerRange, assertRange } from "./lib/validate";
import type { Doc } from "./_generated/dataModel";
import { exerciseReference, requireExercise, resolveExercise, canonicalExerciseId, normalizeExerciseReferences } from "./lib/exerciseCatalog";
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'
import { snapshotStrengthReferences } from './lib/strengthReferences'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

function validatePrescription(exercises: Doc<"routines">["exercises"]) {
 assertIntegerRange(exercises.length, 0, 100, "Exercise count")
 for (const exercise of exercises) {
  assertIntegerRange(exercise.defaultSets, 1, 100, "Planned sets")
  assertIntegerRange(exercise.defaultReps, 0, 1000, "Planned reps")
  assertRange(exercise.defaultWeight ?? 0, 0, 2000, "Planned weight")
 }
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
            const exercise = await resolveExercise(ctx, ex.exerciseId, userId)
            const canRead =
              exercise !== null &&
              (exercise.isDefault === true || exercise.userId === userId)
            return { ...ex, exerciseId: await canonicalExerciseId(ctx, ex.exerciseId), exerciseName: canRead ? exercise.name : 'Unknown' }
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
    return { ...routine, exercises: await normalizeExerciseReferences(ctx, routine.exercises) }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    exercises: v.array(
      v.object({
        exerciseId: exerciseReference,
        defaultSets: v.number(),
        defaultReps: v.number(),
        defaultWeight: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    validatePrescription(args.exercises)
    const exercises = await Promise.all(args.exercises.map(async (ex) => ({ ...ex, exerciseId: await requireExercise(ctx, ex.exerciseId, userId) })))
    return ctx.db.insert('routines', { ...args, exercises, userId })
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
        exerciseId: exerciseReference,
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
    validatePrescription(args.exercises)
    await ctx.db.patch(args.id, {
      name: args.name,
      exercises: await Promise.all(args.exercises.map(async (ex) => ({ ...ex, exerciseId: await requireExercise(ctx, ex.exerciseId, userId) }))),
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
    validatePrescription(routine.exercises)
    const exercises: NonNullable<Doc<"workoutSessions">["exercises"]> = []
    for (const ex of routine.exercises) {
      const exerciseId = await requireExercise(ctx, ex.exerciseId, userId)
      const existingExercise = exercises.find(entry => entry.exerciseId === exerciseId)
      const entry = existingExercise ?? { exerciseId, references: await snapshotStrengthReferences(ctx, userId, exerciseId), plannedSets: [] }
      entry.plannedSets.push(...Array.from({ length: ex.defaultSets }, () => ({ reps: ex.defaultReps, weight: ex.defaultWeight ?? 0, unit: 'kg' as const })))
      if (!existingExercise) exercises.push(entry)
    }
    const now = Date.now()
    const sessionId = await ctx.db.insert('workoutSessions', {
      userId,
      date: now,
      startTime: now,
      name: routine.name,
      routineId,
      exercises,
      status: 'active',
    })
    return sessionId
  },
})
