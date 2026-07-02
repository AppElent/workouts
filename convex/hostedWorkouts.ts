import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { toPublicHostedTemplate } from './lib/hostedDto'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

const level = v.union(
  v.literal('rx'),
  v.literal('l1'),
  v.literal('l2'),
  v.literal('l3'),
)

const movement = v.object({
  name: v.string(),
  reps: v.optional(v.number()),
  weight: v.optional(v.number()),
  unit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
  distance: v.optional(v.number()),
  distanceUnit: v.optional(
    v.union(v.literal('m'), v.literal('km'), v.literal('mi'), v.literal('cal')),
  ),
  notes: v.optional(v.string()),
})

const template = v.object({
  strengthBlocks: v.array(
    v.object({
      blockId: v.string(),
      exerciseId: v.optional(v.id('exercises')),
      exerciseName: v.string(),
      instructions: v.optional(v.string()),
      defaultSets: v.optional(v.number()),
      defaultReps: v.optional(v.number()),
      defaultWeight: v.optional(v.number()),
      unit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
      percentageOfOneRepMax: v.optional(v.number()),
    }),
  ),
  wodBlocks: v.array(
    v.object({
      blockId: v.string(),
      wodId: v.optional(v.id('wods')),
      name: v.string(),
      type: v.union(
        v.literal('forTime'),
        v.literal('amrap'),
        v.literal('emom'),
        v.literal('load'),
      ),
      description: v.optional(v.string()),
      repScheme: v.optional(v.string()),
      timeCapSeconds: v.optional(v.number()),
      durationSeconds: v.optional(v.number()),
      levels: v.array(
        v.object({
          level,
          label: v.string(),
          description: v.optional(v.string()),
          movements: v.array(movement),
        }),
      ),
    }),
  ),
})

function createJoinToken() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const randomValues = new Uint32Array(18)
  const cryptoApi = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto)
  if (!cryptoApi) {
    throw new Error('Crypto randomness is unavailable.')
  }
  cryptoApi(randomValues)
  let token = ''
  for (let i = 0; i < 18; i++) {
    token += alphabet[randomValues[i] % alphabet.length]
  }
  return token
}

async function createUniqueJoinToken(ctx: QueryCtx | MutationCtx) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = createJoinToken()
    const existing = await ctx.db
      .query('hostedWorkouts')
      .withIndex('by_join_token', (q) => q.eq('joinToken', token))
      .first()
    if (!existing) return token
  }
  throw new Error('Unable to create a unique join link.')
}

function assertTemplateIsUsable(input: {
  strengthBlocks: { exerciseName: string }[]
  wodBlocks: { name: string; levels: { level: string }[] }[]
}) {
  if (input.strengthBlocks.length === 0 && input.wodBlocks.length === 0) {
    throw new Error('Add at least one strength block or WOD.')
  }
  for (const block of input.strengthBlocks) {
    if (!block.exerciseName.trim()) throw new Error('Exercise name is required.')
  }
  for (const block of input.wodBlocks) {
    if (!block.name.trim()) throw new Error('WOD name is required.')
    const levels = new Set(block.levels.map((l) => l.level))
    for (const required of ['rx', 'l1', 'l2', 'l3']) {
      if (!levels.has(required))
        throw new Error('Each WOD needs Rx, L1, L2, and L3.')
    }
  }
}

export const createDraft = mutation({
  args: {
    title: v.string(),
    notes: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    hostParticipation: v.union(
      v.literal('hostOnly'),
      v.literal('hostAndParticipate'),
    ),
    template,
  },
  handler: async (ctx, args) => {
    const hostUserId = await requireUser(ctx)
    if (!args.title.trim()) throw new Error('Title is required.')
    assertTemplateIsUsable(args.template)
    const now = Date.now()
    return ctx.db.insert('hostedWorkouts', {
      hostUserId,
      title: args.title.trim(),
      notes: args.notes?.trim() || undefined,
      scheduledAt: args.scheduledAt,
      status: 'draft',
      joinToken: await createUniqueJoinToken(ctx),
      hostParticipation: args.hostParticipation,
      createdAt: now,
      template: args.template,
    })
  },
})

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const hostUserId = await requireUser(ctx)
    return ctx.db
      .query('hostedWorkouts')
      .withIndex('by_host', (q) => q.eq('hostUserId', hostUserId))
      .order('desc')
      .collect()
  },
})

export const getMine = query({
  args: { id: v.id('hostedWorkouts') },
  handler: async (ctx, { id }) => {
    const hostUserId = await requireUser(ctx)
    const hosted = await ctx.db.get(id)
    if (!hosted || hosted.hostUserId !== hostUserId) return null
    const participants = await ctx.db
      .query('hostedWorkoutParticipants')
      .withIndex('by_hosted_workout', (q) => q.eq('hostedWorkoutId', id))
      .collect()
    const submissions = await ctx.db
      .query('hostedWorkoutSubmissions')
      .withIndex('by_hosted_workout', (q) => q.eq('hostedWorkoutId', id))
      .collect()
    return { hosted, participants, submissions }
  },
})

export const getByJoinToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const hosted = await ctx.db
      .query('hostedWorkouts')
      .withIndex('by_join_token', (q) => q.eq('joinToken', token))
      .first()
    if (!hosted) return null
    const submissions = await ctx.db
      .query('hostedWorkoutSubmissions')
      .withIndex('by_hosted_workout', (q) =>
        q.eq('hostedWorkoutId', hosted._id),
      )
      .collect()
    const publicSubmissions = await Promise.all(
      submissions.map(async (submission) => {
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
          timeSeconds: submission.timeSeconds,
          rounds: submission.rounds,
          reps: submission.reps,
          timeCapped: submission.timeCapped,
          load: submission.load,
          loadUnit: submission.loadUnit,
          notes: submission.notes,
          submittedAt: submission.submittedAt,
        }
      }),
    )
    return {
      hosted: {
        title: hosted.title,
        notes: hosted.notes,
        scheduledAt: hosted.scheduledAt,
        status: hosted.status,
        template: toPublicHostedTemplate(hosted.template),
      },
      submissions: publicSubmissions,
    }
  },
})

export const updateDraft = mutation({
  args: {
    id: v.id('hostedWorkouts'),
    title: v.string(),
    notes: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    hostParticipation: v.union(
      v.literal('hostOnly'),
      v.literal('hostAndParticipate'),
    ),
    template,
  },
  handler: async (ctx, { id, ...patch }) => {
    const hostUserId = await requireUser(ctx)
    const hosted = await ctx.db.get(id)
    if (!hosted || hosted.hostUserId !== hostUserId)
      throw new Error('Unauthorized')
    if (hosted.status !== 'draft')
      throw new Error('Only draft workouts can be edited.')
    if (!patch.title.trim()) throw new Error('Title is required.')
    assertTemplateIsUsable(patch.template)
    await ctx.db.patch(id, {
      ...patch,
      title: patch.title.trim(),
      notes: patch.notes?.trim() || undefined,
    })
  },
})

export const open = mutation({
  args: { id: v.id('hostedWorkouts') },
  handler: async (ctx, { id }) => {
    const hostUserId = await requireUser(ctx)
    const hosted = await ctx.db.get(id)
    if (!hosted || hosted.hostUserId !== hostUserId)
      throw new Error('Unauthorized')
    if (hosted.status !== 'draft')
      throw new Error('Only draft workouts can be opened.')
    await ctx.db.patch(id, { status: 'open', openedAt: Date.now() })
    if (hosted.hostParticipation === 'hostAndParticipate') {
      const existing = await ctx.db
        .query('hostedWorkoutParticipants')
        .withIndex('by_hosted_workout_user', (q) =>
          q.eq('hostedWorkoutId', id).eq('userId', hostUserId),
        )
        .first()
      if (!existing) {
        const active = await ctx.db
          .query('workoutSessions')
          .withIndex('by_user_status', (q) =>
            q.eq('userId', hostUserId).eq('status', 'active'),
          )
          .first()
        if (active)
          throw new Error('Finish or cancel your active workout before opening.')
        const now = Date.now()
        const sessionId = await ctx.db.insert('workoutSessions', {
          userId: hostUserId,
          date: hosted.scheduledAt ?? now,
          startTime: now,
          name: hosted.title,
          status: 'active',
        })
        await ctx.db.insert('hostedWorkoutParticipants', {
          hostedWorkoutId: id,
          userId: hostUserId,
          sessionId,
          joinedAt: now,
          displayName: 'Host',
        })
      }
    }
  },
})

// Joining a hosted workout (via `join`, or `open` for host-and-participate)
// creates a `workoutSessions` row with status 'active'. The app enforces a
// single active session per user, so an active hosted session that is never
// finished would lock the participant out of starting/joining anything else.
// Whenever a hosted workout ends (closed or removed), finish every linked
// session that is still active so no participant (nor the host) is stranded.
async function finishParticipantSessions(
  ctx: MutationCtx,
  hostedWorkoutId: Id<'hostedWorkouts'>,
) {
  const participants = await ctx.db
    .query('hostedWorkoutParticipants')
    .withIndex('by_hosted_workout', (q) =>
      q.eq('hostedWorkoutId', hostedWorkoutId),
    )
    .collect()
  const now = Date.now()
  for (const participant of participants) {
    const session = await ctx.db.get(participant.sessionId)
    if (session && session.status === 'active') {
      await ctx.db.patch(participant.sessionId, {
        status: 'completed',
        endTime: now,
      })
    }
  }
}

export const close = mutation({
  args: { id: v.id('hostedWorkouts') },
  handler: async (ctx, { id }) => {
    const hostUserId = await requireUser(ctx)
    const hosted = await ctx.db.get(id)
    if (!hosted || hosted.hostUserId !== hostUserId)
      throw new Error('Unauthorized')
    if (hosted.status !== 'open')
      throw new Error('Only open workouts can be closed.')
    await ctx.db.patch(id, { status: 'closed', closedAt: Date.now() })
    await finishParticipantSessions(ctx, id)
  },
})

export const remove = mutation({
  args: { id: v.id('hostedWorkouts') },
  handler: async (ctx, { id }) => {
    const hostUserId = await requireUser(ctx)
    const hosted = await ctx.db.get(id)
    if (!hosted || hosted.hostUserId !== hostUserId)
      throw new Error('Unauthorized')
    await finishParticipantSessions(ctx, id)
    const submissions = await ctx.db
      .query('hostedWorkoutSubmissions')
      .withIndex('by_hosted_workout', (q) => q.eq('hostedWorkoutId', id))
      .collect()
    for (const submission of submissions) await ctx.db.delete(submission._id)
    const participants = await ctx.db
      .query('hostedWorkoutParticipants')
      .withIndex('by_hosted_workout', (q) => q.eq('hostedWorkoutId', id))
      .collect()
    for (const participant of participants) await ctx.db.delete(participant._id)
    await ctx.db.delete(id)
  },
})

