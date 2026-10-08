import { exerciseReference, canonicalExerciseId, exerciseReferenceIds, normalizeExerciseReferences } from "./lib/exerciseCatalog";
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'
import { canonicalJson } from '@workouts/core'
import { assertOptionalRange, assertRange, assertIntegerRange, assertOptionalRpe } from './lib/validate'
import { ensureSessionExercise } from './lib/strengthSession'
import { performanceReference, recalcStrengthReferences } from './lib/strengthReferences'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

export { recalcStrengthReferences as recalcOneRepMax } from "./lib/strengthReferences"

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
    // Optional only for existing web/native clients during additive rollout.
    operationId: v.optional(v.string()),
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
    try {
      assertIntegerRange(args.reps, 0, 1000, 'Reps')
      assertIntegerRange(args.setNumber, 1, 10000, 'Set number')
      assertRange(args.weight, 0, 2000, 'Weight')
      assertOptionalRpe(args.rpe)
    } catch (error) {
      // A typed rejection proves this operation did not commit. Clients may
      // unlock its input; transport failures retain the frozen operation ID.
      throw new ConvexError(error instanceof Error ? error.message : 'Invalid set')
    }
    const { operationId, ...values } = args
    const payload = canonicalJson(values)
    if (operationId) {
      const receipt = await ctx.db.query('strengthLogReceipts')
        .withIndex('by_user_operation', q => q.eq('userId', userId).eq('operationId', operationId)).unique()
      if (receipt) {
        if (receipt.payload !== payload) throw new Error('This Log was already submitted with different details.')
        return receipt.setId
      }
    }
    args.exerciseId = await ensureSessionExercise(ctx, userId, args.sessionId, args.exerciseId)
    const setId = await ctx.db.insert('sets', {
      ...values,
      exerciseId: args.exerciseId,
      userId,
      loggedAt: Date.now(),
      performanceVerified: true,
      ...await performanceReference(ctx, userId, { ...values, exerciseId: args.exerciseId, performanceVerified: true }),
    })
    if (operationId) await ctx.db.insert('strengthLogReceipts', { userId, operationId, payload, setId })
    await recalcStrengthReferences(ctx, userId, args.exerciseId)
    return setId
  },
})

export const getLogResult = query({
  args: { operationId: v.string() },
  handler: async (ctx, { operationId }) => {
    const userId = await requireUser(ctx)
    const receipt = await ctx.db.query('strengthLogReceipts')
      .withIndex('by_user_operation', q => q.eq('userId', userId).eq('operationId', operationId)).unique()
    if (!receipt) return null
    return { setId: receipt.setId, status: await ctx.db.get(receipt.setId) ? 'saved' as const : 'removed' as const }
  },
})

export const update = mutation({
  args: {
    id: v.id('sets'),
    reps: v.optional(v.number()),
    weight: v.optional(v.number()),
    unit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
    rpe: v.optional(v.union(v.number(), v.null())),
    setType: v.optional(
      v.union(
        v.literal('warmup'),
        v.literal('working'),
        v.literal('drop'),
        v.literal('failure'),
      ),
    ),
  },
  handler: async (ctx, { id, rpe, ...values }) => {
    const patch = { ...values, ...(rpe === undefined ? {} : { rpe: rpe ?? undefined }) }
    const userId = await requireUser(ctx)
    if (patch.reps !== undefined) assertIntegerRange(patch.reps, 0, 1000, 'Reps')
    assertOptionalRange(patch.weight, 0, 2000, 'Weight')
    assertOptionalRpe(patch.rpe)
    const set = await ctx.db.get(id)
    if (!set || set.userId !== userId) throw new Error('Unauthorized')
    await ctx.db.patch(id, { ...patch, exerciseId: await canonicalExerciseId(ctx, set.exerciseId), ...await performanceReference(ctx, userId, { ...set, ...patch }) })
    await recalcStrengthReferences(ctx, userId, set.exerciseId)
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

    // Compatibility endpoint: repeating prepares values. Only `add` records work.
    return {
      sessionId: src.sessionId,
      exerciseId,
      setNumber: maxNum + 1,
      reps: src.reps,
      weight: src.weight,
      unit: src.unit,
      rpe: src.rpe,
      setType: src.setType,
    }
  },
})

export const getLastForExercise = query({
  args: { exerciseId: exerciseReference, excludeSessionId: v.optional(v.id("workoutSessions")) },
  handler: async (ctx, { exerciseId, excludeSessionId }) => {
    const userId = await requireUser(ctx)
    exerciseId = await canonicalExerciseId(ctx, exerciseId)
    return latestSetForExercise(ctx, userId, exerciseId, excludeSessionId)
  },
})

export const getPreviousForExercise = query({
  args: { exerciseId: exerciseReference, sessionId: v.id('workoutSessions') },
  handler: async (ctx, { exerciseId, sessionId }) => {
    const userId = await requireUser(ctx)
    exerciseId = await canonicalExerciseId(ctx, exerciseId)
    const latest = await latestSetForExercise(ctx, userId, exerciseId, sessionId)
    if (!latest) return []
    const references = await exerciseReferenceIds(ctx, exerciseId)
    const sets = (await Promise.all(references.map(id => ctx.db.query('sets')
      .withIndex('by_session_exercise', q => q.eq('sessionId', latest.sessionId).eq('exerciseId', id)).collect()))).flat()
    return sets.filter(set => set.userId === userId).map(set => ({ ...set, exerciseId })).sort((a, b) => a.setNumber - b.setNumber)
  },
})

async function latestSetForExercise(ctx: QueryCtx, userId: string, exerciseId: string, excludeSessionId?: Id<'workoutSessions'>) {
  const references = await exerciseReferenceIds(ctx, exerciseId)
  const candidates = await Promise.all(references.map(async id => {
    const history = ctx.db.query('sets').withIndex('by_user_exercise_logged_at', q => q.eq('userId', userId).eq('exerciseId', id)).order('desc')
    // Stop at the first eligible row, reading only the excluded current session
    // ahead of it, rather than loading all historical performances.
    for await (const set of history) if (set.sessionId !== excludeSessionId) return set
    return null
  }))
  const latest = candidates.filter(set => set !== null).sort((a, b) => b.loggedAt - a.loggedAt || b._creationTime - a._creationTime)[0]
  return latest ? { ...latest, exerciseId } : null
}

export const remove = mutation({
  args: { id: v.id('sets') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const set = await ctx.db.get(id)
    if (!set || set.userId !== userId) throw new Error('Unauthorized')
    const exerciseId = set.exerciseId
    await ctx.db.delete(id)
    await recalcStrengthReferences(ctx, userId, exerciseId)
  },
})
