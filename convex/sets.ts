import { exerciseReference, canonicalExerciseId, requireExercise, exerciseReferenceIds, exerciseOneRepMaxes, normalizeExerciseReferences } from "./lib/exerciseCatalog";
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'
import { calculateOneRepMax } from '@workouts/core'
import { assertOptionalRange, assertRange } from './lib/validate'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

export async function recalcOneRepMax(
  ctx: MutationCtx,
  userId: string,
  exerciseId: string,
) {
  exerciseId = await canonicalExerciseId(ctx, exerciseId)
  const orms = await exerciseOneRepMaxes(ctx, userId, exerciseId)
  if (orms.some((orm) => orm.source === 'manual')) return
  for (const orm of orms) await ctx.db.delete(orm._id)
  const referenceIds = await exerciseReferenceIds(ctx, exerciseId)
  const candidates = await Promise.all(referenceIds.map(async (id) => {
    const unindexed = await ctx.db.query('sets').withIndex('by_user_exercise_estimate', q => q.eq('userId', userId).eq('exerciseId', id).eq('estimatedMax', undefined)).first()
    if (unindexed) {
      // Compatibility until the operator backfill finishes. New writes always index
      // their estimate; the normal path reads one winning set per legacy alias.
      const legacy = await ctx.db.query('sets').withIndex('by_user_exercise', q => q.eq('userId', userId).eq('exerciseId', id)).collect()
      return legacy.filter(set => set.weight > 0).sort((a, b) => calculateOneRepMax(b.weight, b.reps).value - calculateOneRepMax(a.weight, a.reps).value)[0] ?? null
    }
    return ctx.db.query('sets').withIndex('by_user_exercise_estimate', q => q.eq('userId', userId).eq('exerciseId', id).gt('estimatedMax', 0)).order('desc').first()
  }))
  const bestSet = candidates.filter(set => set !== null).sort((a, b) => calculateOneRepMax(b.weight, b.reps).value - calculateOneRepMax(a.weight, a.reps).value)[0]
  if (!bestSet) return
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
    return normalizeExerciseReferences(ctx, sets.filter((s) => s.userId === userId))
  },
})

export const add = mutation({
  args: {
    sessionId: v.id('workoutSessions'),
    exerciseId: exerciseReference,
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
    assertRange(args.reps, 0, 1000, 'Reps')
    assertRange(args.weight, 0, 2000, 'Weight')
    assertOptionalRange(args.rpe, 1, 10, 'RPE')
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userId !== userId) throw new Error('Unauthorized')
    args.exerciseId = await requireExercise(ctx, args.exerciseId, userId)
    const setId = await ctx.db.insert('sets', {
      ...args,
      userId,
      loggedAt: Date.now(),
      estimatedMax: args.weight > 0 ? calculateOneRepMax(args.weight, args.reps).value : 0,
    })
    const orms = await exerciseOneRepMaxes(ctx, userId, args.exerciseId)
    if (!orms.some((orm) => orm.source === 'manual') && args.weight > 0) {
      const { value, source, formula } = calculateOneRepMax(args.weight, args.reps)
      const current = orms.filter((orm) => orm.source !== 'manual').sort((a, b) => b.value - a.value)[0]
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
    assertOptionalRange(patch.reps, 0, 1000, 'Reps')
    assertOptionalRange(patch.weight, 0, 2000, 'Weight')
    assertOptionalRange(patch.rpe, 1, 10, 'RPE')
    const set = await ctx.db.get(id)
    if (!set || set.userId !== userId) throw new Error('Unauthorized')
    await ctx.db.patch(id, { ...patch, exerciseId: await canonicalExerciseId(ctx, set.exerciseId), estimatedMax: (patch.weight ?? set.weight) > 0 ? calculateOneRepMax(patch.weight ?? set.weight, patch.reps ?? set.reps).value : 0 })
    await recalcOneRepMax(ctx, userId, set.exerciseId)
  },
})

export const duplicate = mutation({
  args: { id: v.id('sets') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const src = await ctx.db.get(id)
    if (!src || src.userId !== userId) throw new Error('Unauthorized')

    const exerciseId = await canonicalExerciseId(ctx, src.exerciseId)
    const referenceIds = await exerciseReferenceIds(ctx, exerciseId)
    const sessionSets = (await Promise.all(referenceIds.map((referenceId) => ctx.db.query('sets')
      .withIndex('by_session_exercise', (q) => q.eq('sessionId', src.sessionId).eq('exerciseId', referenceId))
      .collect()))).flat().filter((set) => set.userId === userId)
    const maxNum = sessionSets.reduce(
      (m, s) => (s.setNumber > m ? s.setNumber : m),
      0,
    )

    const newId = await ctx.db.insert('sets', {
      userId,
      sessionId: src.sessionId,
      exerciseId,
      setNumber: maxNum + 1,
      reps: src.reps,
      weight: src.weight,
      unit: src.unit,
      rpe: src.rpe,
      setType: src.setType,
      loggedAt: Date.now(),
      estimatedMax: src.weight > 0 ? calculateOneRepMax(src.weight, src.reps).value : 0,
    })
    await recalcOneRepMax(ctx, userId, src.exerciseId)
    return newId
  },
})

export const getLastForExercise = query({
  args: { exerciseId: exerciseReference },
  handler: async (ctx, { exerciseId }) => {
    const userId = await requireUser(ctx)
    exerciseId = await canonicalExerciseId(ctx, exerciseId)
    const references = await exerciseReferenceIds(ctx, exerciseId)
    const sets = await Promise.all(references.map(id => ctx.db.query('sets').withIndex('by_user_exercise', q => q.eq('userId', userId).eq('exerciseId', id)).order('desc').first()))
    const latest = sets.filter(set => set !== null).sort((a, b) => b._creationTime - a._creationTime)[0]
    return latest ? { ...latest, exerciseId } : null
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
