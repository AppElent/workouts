import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { assertOptionalRange } from './lib/validate'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

const scoreFields = {
  level: v.union(v.literal('rx'), v.literal('l1'), v.literal('l2'), v.literal('l3')),
  rxScaled: v.optional(v.union(v.literal('rx'), v.literal('scaled'))),
  timeSeconds: v.optional(v.number()),
  rounds: v.optional(v.number()),
  reps: v.optional(v.number()),
  timeCapped: v.optional(v.boolean()),
  load: v.optional(v.number()),
  loadUnit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
  notes: v.optional(v.string()),
}

type Score = {
  level: 'rx' | 'l1' | 'l2' | 'l3'
  rxScaled?: 'rx' | 'scaled'
  timeSeconds?: number
  rounds?: number
  reps?: number
  timeCapped?: boolean
  load?: number
  loadUnit?: 'kg' | 'lbs'
  notes?: string
}

type WodBlock = Doc<'hostedWorkouts'>['template']['wodBlocks'][number]
type HostedSubmission = Doc<'hostedWorkoutSubmissions'>

function assertScoreRanges(score: {
  timeSeconds?: number
  rounds?: number
  reps?: number
  load?: number
}) {
  assertOptionalRange(score.timeSeconds, 0, 86400, 'Time')
  assertOptionalRange(score.rounds, 0, 10000, 'Rounds')
  assertOptionalRange(score.reps, 0, 100000, 'Reps')
  assertOptionalRange(score.load, 0, 2000, 'Load')
}

function assertScoreMatchesWod(type: WodBlock['type'], score: Score) {
  if (type === 'forTime' && score.timeSeconds === undefined) {
    throw new Error('Time is required for this WOD.')
  }
  if (
    type === 'forTime' &&
    score.timeCapped === true &&
    score.reps === undefined
  ) {
    throw new Error('Reps are required for capped scores.')
  }
  if (
    type === 'amrap' &&
    score.rounds === undefined &&
    score.reps === undefined
  ) {
    throw new Error('Rounds or reps are required for this WOD.')
  }
  if (
    type === 'emom' &&
    score.reps === undefined &&
    score.rounds === undefined
  ) {
    throw new Error('Completed reps or rounds are required for this WOD.')
  }
  if (type === 'load' && score.load === undefined) {
    throw new Error('Load is required for this WOD.')
  }
  if (type === 'load' && score.loadUnit === undefined) {
    throw new Error('Load unit is required for this WOD.')
  }
}

function findWodBlock(hosted: Doc<'hostedWorkouts'>, wodBlockId: string) {
  return (
    hosted.template.wodBlocks.find((block) => block.blockId === wodBlockId) ??
    null
  )
}

function findLevel(block: WodBlock, level: Score['level']) {
  return block.levels.find((entry) => entry.level === level) ?? null
}

async function getHostedForHost(
  ctx: QueryCtx | MutationCtx,
  hostedWorkoutId: Id<'hostedWorkouts'>,
  hostUserId: string,
) {
  const hosted = await ctx.db.get(hostedWorkoutId)
  if (!hosted || hosted.hostUserId !== hostUserId) {
    throw new Error('Unauthorized')
  }
  return hosted
}

async function toPublicSubmission(
  ctx: QueryCtx,
  submission: HostedSubmission,
) {
  let athleteName = 'Unknown athlete'
  if (submission.guestName) {
    athleteName = submission.guestName
  } else if (submission.participantId) {
    const participant = await ctx.db.get(submission.participantId)
    athleteName = participant?.displayName ?? 'Signed-in athlete'
  }
  return {
    athleteName,
    guestName: submission.guestName,
    wodBlockId: submission.wodBlockId,
    level: submission.level,
    rxScaled: submission.rxScaled,
    timeSeconds: submission.timeSeconds,
    rounds: submission.rounds,
    reps: submission.reps,
    timeCapped: submission.timeCapped,
    load: submission.load,
    loadUnit: submission.loadUnit,
    notes: submission.notes,
    submittedAt: submission.submittedAt,
  }
}

export const submitForParticipant = mutation({
  args: {
    participantId: v.id('hostedWorkoutParticipants'),
    wodBlockId: v.string(),
    ...scoreFields,
  },
  handler: async (ctx, { participantId, wodBlockId, ...score }) => {
    const userId = await requireUser(ctx)
    assertScoreRanges(score)
    const participant = await ctx.db.get(participantId)
    if (!participant || participant.userId !== userId) {
      throw new Error('Unauthorized')
    }
    const hosted = await ctx.db.get(participant.hostedWorkoutId)
    if (!hosted) throw new Error('Hosted workout not found.')
    if (hosted.status !== 'open') throw new Error('This hosted workout is closed.')
    const wodBlock = findWodBlock(hosted, wodBlockId)
    if (!wodBlock) throw new Error('WOD block not found.')
    const selectedLevel = findLevel(wodBlock, score.level)
    if (!selectedLevel) throw new Error('Level not found for this WOD.')
    assertScoreMatchesWod(wodBlock.type, score)

    const now = Date.now()
    let wodId = wodBlock.wodId
    if (!wodId) {
      wodId = await ctx.db.insert('wods', {
        userId,
        name: wodBlock.name,
        type: wodBlock.type,
        description: wodBlock.description,
        repScheme: wodBlock.repScheme,
        timeCapSeconds: wodBlock.timeCapSeconds,
        durationSeconds: wodBlock.durationSeconds,
        movements: selectedLevel.movements,
        isDefault: false,
      })
    }

    await ctx.db.insert('wodResults', {
      userId,
      wodId,
      sessionId: participant.sessionId,
      date: now,
      rxScaled: score.rxScaled ?? (score.level === 'rx' ? 'rx' : 'scaled'),
      timeSeconds: score.timeSeconds,
      rounds: score.rounds,
      reps: score.reps,
      timeCapped: score.timeCapped,
      load: score.load,
      loadUnit: score.loadUnit,
      notes: score.notes,
    })

    return ctx.db.insert('hostedWorkoutSubmissions', {
      hostedWorkoutId: participant.hostedWorkoutId,
      participantId,
      wodBlockId,
      submittedAt: now,
      ...score,
    })
  },
})

export const submitGuest = mutation({
  args: {
    token: v.string(),
    guestName: v.string(),
    wodBlockId: v.string(),
    ...scoreFields,
  },
  handler: async (ctx, { token, guestName, wodBlockId, ...score }) => {
    assertScoreRanges(score)
    const cleanName = guestName.trim()
    if (cleanName.length < 2 || cleanName.length > 80) {
      throw new Error('Enter a display name between 2 and 80 characters.')
    }
    const hosted = await ctx.db
      .query('hostedWorkouts')
      .withIndex('by_join_token', (q) => q.eq('joinToken', token))
      .first()
    if (!hosted) throw new Error('Hosted workout not found.')
    if (hosted.status !== 'open') throw new Error('This hosted workout is closed.')
    const wodBlock = findWodBlock(hosted, wodBlockId)
    if (!wodBlock) throw new Error('WOD block not found.')
    const selectedLevel = findLevel(wodBlock, score.level)
    if (!selectedLevel) throw new Error('Level not found for this WOD.')
    assertScoreMatchesWod(wodBlock.type, score)

    return ctx.db.insert('hostedWorkoutSubmissions', {
      hostedWorkoutId: hosted._id,
      guestName: cleanName,
      wodBlockId,
      submittedAt: Date.now(),
      ...score,
    })
  },
})

export const listForHost = query({
  args: { hostedWorkoutId: v.id('hostedWorkouts') },
  handler: async (ctx, { hostedWorkoutId }) => {
    const hostUserId = await requireUser(ctx)
    await getHostedForHost(ctx, hostedWorkoutId, hostUserId)
    return ctx.db
      .query('hostedWorkoutSubmissions')
      .withIndex('by_hosted_workout', (q) =>
        q.eq('hostedWorkoutId', hostedWorkoutId),
      )
      .collect()
  },
})

export const listPublicLeaderboard = query({
  args: { hostedWorkoutId: v.id('hostedWorkouts') },
  handler: async (ctx, { hostedWorkoutId }) => {
    const hosted = await ctx.db.get(hostedWorkoutId)
    if (!hosted || hosted.status === 'draft') return []
    const submissions = await ctx.db
      .query('hostedWorkoutSubmissions')
      .withIndex('by_hosted_workout', (q) =>
        q.eq('hostedWorkoutId', hostedWorkoutId),
      )
      .collect()
    return Promise.all(
      submissions.map((submission) => toPublicSubmission(ctx, submission)),
    )
  },
})

export const remove = mutation({
  args: { id: v.id('hostedWorkoutSubmissions') },
  handler: async (ctx, { id }) => {
    const hostUserId = await requireUser(ctx)
    const submission = await ctx.db.get(id)
    if (!submission) throw new Error('Submission not found.')
    const hosted = await ctx.db.get(submission.hostedWorkoutId)
    if (!hosted || hosted.hostUserId !== hostUserId) {
      throw new Error('Unauthorized')
    }
    await ctx.db.delete(id)
  },
})

