import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { assertOptionalRange } from './lib/validate'

// A non-open workout can't be scored. Word it for the actual status so a draft
// that was never opened doesn't say it is "closed".
function assertOpenForScoring(status: 'draft' | 'open' | 'closed') {
  if (status === 'open') return
  throw new ConvexError(
    status === 'closed'
      ? 'This workout has closed.'
      : "This workout hasn't opened yet.",
  )
}

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError('Unauthenticated')
  return identity.subject
}

const level = v.union(
  v.literal('rx'),
  v.literal('l1'),
  v.literal('l2'),
  v.literal('l3'),
)

const scoreFields = {
  level,
  timeSeconds: v.optional(v.number()),
  rounds: v.optional(v.number()),
  reps: v.optional(v.number()),
  timeCapped: v.optional(v.boolean()),
  load: v.optional(v.number()),
  loadUnit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
  notes: v.optional(v.string()),
}

type HostedLevel = 'rx' | 'l1' | 'l2' | 'l3'

type Score = {
  level: HostedLevel
  timeSeconds?: number
  rounds?: number
  reps?: number
  timeCapped?: boolean
  load?: number
  loadUnit?: 'kg' | 'lbs'
  notes?: string
}

type WodBlock = Doc<'hostedWorkouts'>['template']['wodBlocks'][number]

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
  if (type === 'forTime') {
    if (score.timeCapped === true) {
      if (score.reps === undefined) {
        throw new ConvexError('Reps are required for capped scores.')
      }
      return
    }
    if (score.timeSeconds === undefined) {
      throw new ConvexError('Time is required for this WOD.')
    }
    return
  }
  if (
    type === 'amrap' &&
    score.rounds === undefined &&
    score.reps === undefined
  ) {
    throw new ConvexError('Rounds or reps are required for this WOD.')
  }
  if (
    type === 'emom' &&
    score.reps === undefined &&
    score.rounds === undefined
  ) {
    throw new ConvexError('Completed reps or rounds are required for this WOD.')
  }
  if (type === 'load' && score.load === undefined) {
    throw new ConvexError('Load is required for this WOD.')
  }
  if (type === 'load' && score.loadUnit === undefined) {
    throw new ConvexError('Load unit is required for this WOD.')
  }
}

function findWodBlock(hosted: Doc<'hostedWorkouts'>, wodBlockId: string) {
  return (
    hosted.template.wodBlocks.find((block) => block.blockId === wodBlockId) ??
    null
  )
}

function findLevel(block: WodBlock, selectedLevel: HostedLevel) {
  return block.levels.find((entry) => entry.level === selectedLevel) ?? null
}

function rxScaledForLevel(selectedLevel: HostedLevel): 'rx' | 'scaled' {
  return selectedLevel === 'rx' ? 'rx' : 'scaled'
}

async function getHostedForHost(
  ctx: QueryCtx | MutationCtx,
  hostedWorkoutId: Id<'hostedWorkouts'>,
  hostUserId: string,
) {
  const hosted = await ctx.db.get(hostedWorkoutId)
  if (!hosted || hosted.hostUserId !== hostUserId) {
    throw new ConvexError('Unauthorized')
  }
  return hosted
}

async function getOwnedParticipantBySession(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<'workoutSessions'>,
  userId: string,
) {
  const participant = await ctx.db
    .query('hostedWorkoutParticipants')
    .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
    .first()
  if (!participant || participant.userId !== userId) {
    throw new ConvexError('Unauthorized')
  }
  return participant
}

async function findParticipantSubmission(
  ctx: MutationCtx,
  hostedWorkoutId: Id<'hostedWorkouts'>,
  wodBlockId: string,
  participantId: Id<'hostedWorkoutParticipants'>,
) {
  const rows = await ctx.db
    .query('hostedWorkoutSubmissions')
    .withIndex('by_hosted_workout_wod', (q) =>
      q.eq('hostedWorkoutId', hostedWorkoutId).eq('wodBlockId', wodBlockId),
    )
    .collect()
  return rows.find((row) => row.participantId === participantId) ?? null
}

// One submission per participant per WOD block. Re-submitting updates the
// existing leaderboard row (no duplicates) and reuses the athlete's personal
// wods/wodResults records rather than creating a fresh WOD each time.
async function upsertSignedInSubmission(
  ctx: MutationCtx,
  participant: Doc<'hostedWorkoutParticipants'>,
  userId: string,
  wodBlockId: string,
  score: Score,
) {
  assertScoreRanges(score)
  const hosted = await ctx.db.get(participant.hostedWorkoutId)
  if (!hosted) throw new ConvexError('Hosted workout not found.')
  assertOpenForScoring(hosted.status)
  const wodBlock = findWodBlock(hosted, wodBlockId)
  if (!wodBlock) throw new ConvexError('WOD block not found.')
  const selectedLevel = findLevel(wodBlock, score.level)
  if (!selectedLevel) throw new ConvexError('Level not found for this WOD.')
  assertScoreMatchesWod(wodBlock.type, score)

  const now = Date.now()
  const wodDefinition = {
    name: wodBlock.name,
    type: wodBlock.type,
    description: wodBlock.description,
    repScheme: wodBlock.repScheme,
    timeCapSeconds: wodBlock.timeCapSeconds,
    durationSeconds: wodBlock.durationSeconds,
    movements: selectedLevel.movements,
  }
  const scoreFieldsPatch = {
    level: score.level,
    timeSeconds: score.timeSeconds,
    rounds: score.rounds,
    reps: score.reps,
    timeCapped: score.timeCapped,
    load: score.load,
    loadUnit: score.loadUnit,
    notes: score.notes,
  }
  const resultPatch = {
    date: now,
    rxScaled: rxScaledForLevel(score.level),
    timeSeconds: score.timeSeconds,
    rounds: score.rounds,
    reps: score.reps,
    timeCapped: score.timeCapped,
    load: score.load,
    loadUnit: score.loadUnit,
    notes: score.notes,
  }

  const existing = await findParticipantSubmission(
    ctx,
    participant.hostedWorkoutId,
    wodBlockId,
    participant._id,
  )

  if (existing) {
    let wodId = existing.wodId
    if (wodId) {
      await ctx.db.patch(wodId, wodDefinition)
    } else {
      wodId = await ctx.db.insert('wods', {
        userId,
        isDefault: false,
        ...wodDefinition,
      })
    }
    let wodResultId = existing.wodResultId
    if (wodResultId) {
      await ctx.db.patch(wodResultId, resultPatch)
    } else {
      wodResultId = await ctx.db.insert('wodResults', {
        userId,
        wodId,
        sessionId: participant.sessionId,
        ...resultPatch,
      })
    }
    await ctx.db.patch(existing._id, {
      ...scoreFieldsPatch,
      wodId,
      wodResultId,
      submittedAt: now,
    })
    return existing._id
  }

  const wodId = await ctx.db.insert('wods', {
    userId,
    isDefault: false,
    ...wodDefinition,
  })
  const wodResultId = await ctx.db.insert('wodResults', {
    userId,
    wodId,
    sessionId: participant.sessionId,
    ...resultPatch,
  })
  return ctx.db.insert('hostedWorkoutSubmissions', {
    hostedWorkoutId: participant.hostedWorkoutId,
    participantId: participant._id,
    wodBlockId,
    ...scoreFieldsPatch,
    wodId,
    wodResultId,
    submittedAt: now,
  })
}

export const submitForSession = mutation({
  args: {
    sessionId: v.id('workoutSessions'),
    wodBlockId: v.string(),
    ...scoreFields,
  },
  handler: async (ctx, { sessionId, wodBlockId, ...score }) => {
    const userId = await requireUser(ctx)
    const participant = await getOwnedParticipantBySession(ctx, sessionId, userId)
    return upsertSignedInSubmission(ctx, participant, userId, wodBlockId, score)
  },
})

export const submitForParticipant = mutation({
  args: {
    participantId: v.id('hostedWorkoutParticipants'),
    wodBlockId: v.string(),
    ...scoreFields,
  },
  handler: async (ctx, { participantId, wodBlockId, ...score }) => {
    const userId = await requireUser(ctx)
    const participant = await ctx.db.get(participantId)
    if (!participant || participant.userId !== userId) {
      throw new ConvexError('Unauthorized')
    }
    return upsertSignedInSubmission(ctx, participant, userId, wodBlockId, score)
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
      throw new ConvexError('Enter a display name between 2 and 80 characters.')
    }
    const hosted = await ctx.db
      .query('hostedWorkouts')
      .withIndex('by_join_token', (q) => q.eq('joinToken', token))
      .first()
    if (!hosted) throw new ConvexError('Hosted workout not found.')
    assertOpenForScoring(hosted.status)
    const wodBlock = findWodBlock(hosted, wodBlockId)
    if (!wodBlock) throw new ConvexError('WOD block not found.')
    const selectedLevel = findLevel(wodBlock, score.level)
    if (!selectedLevel) throw new ConvexError('Level not found for this WOD.')
    assertScoreMatchesWod(wodBlock.type, score)

    const scoreFieldsPatch = {
      level: score.level,
      timeSeconds: score.timeSeconds,
      rounds: score.rounds,
      reps: score.reps,
      timeCapped: score.timeCapped,
      load: score.load,
      loadUnit: score.loadUnit,
      notes: score.notes,
    }

    // One submission per guest name per WOD block: re-submitting updates the
    // existing leaderboard row instead of adding a duplicate.
    const rows = await ctx.db
      .query('hostedWorkoutSubmissions')
      .withIndex('by_hosted_workout_wod', (q) =>
        q.eq('hostedWorkoutId', hosted._id).eq('wodBlockId', wodBlockId),
      )
      .collect()
    const existing = rows.find((row) => row.guestName === cleanName)
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...scoreFieldsPatch,
        submittedAt: Date.now(),
      })
      return existing._id
    }

    return ctx.db.insert('hostedWorkoutSubmissions', {
      hostedWorkoutId: hosted._id,
      guestName: cleanName,
      wodBlockId,
      ...scoreFieldsPatch,
      submittedAt: Date.now(),
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

export const remove = mutation({
  args: { id: v.id('hostedWorkoutSubmissions') },
  handler: async (ctx, { id }) => {
    const hostUserId = await requireUser(ctx)
    const submission = await ctx.db.get(id)
    if (!submission) throw new ConvexError('Submission not found.')
    const hosted = await ctx.db.get(submission.hostedWorkoutId)
    if (!hosted || hosted.hostUserId !== hostUserId) {
      throw new ConvexError('Unauthorized')
    }
    // Clean up the personal records created for this submission so removing a
    // score doesn't leave orphaned wods/wodResults in the athlete's library.
    if (submission.wodResultId) await ctx.db.delete(submission.wodResultId)
    if (submission.wodId) await ctx.db.delete(submission.wodId)
    await ctx.db.delete(id)
  },
})
