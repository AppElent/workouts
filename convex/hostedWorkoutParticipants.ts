import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { toHostedSessionDto } from './lib/hostedDto'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

export const join = mutation({
  args: { token: v.string(), displayName: v.optional(v.string()) },
  handler: async (ctx, { token, displayName }) => {
    const userId = await requireUser(ctx)
    const hosted = await ctx.db
      .query('hostedWorkouts')
      .withIndex('by_join_token', (q) => q.eq('joinToken', token))
      .first()
    if (!hosted) throw new Error('Hosted workout not found.')
    if (hosted.status !== 'open') throw new Error('This hosted workout is not open.')

    const existing = await ctx.db
      .query('hostedWorkoutParticipants')
      .withIndex('by_hosted_workout_user', (q) =>
        q.eq('hostedWorkoutId', hosted._id).eq('userId', userId),
      )
      .first()
    if (existing) return existing.sessionId

    const active = await ctx.db
      .query('workoutSessions')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', userId).eq('status', 'active'),
      )
      .first()
    if (active) throw new Error('Finish or cancel your active workout before joining.')

    const now = Date.now()
    const sessionId = await ctx.db.insert('workoutSessions', {
      userId,
      date: hosted.scheduledAt ?? now,
      startTime: now,
      name: hosted.title,
      status: 'active',
    })
    await ctx.db.insert('hostedWorkoutParticipants', {
      hostedWorkoutId: hosted._id,
      userId,
      sessionId,
      joinedAt: now,
      displayName: displayName?.trim() || undefined,
    })
    return sessionId
  },
})

export const getMyParticipant = query({
  args: { hostedWorkoutId: v.id('hostedWorkouts') },
  handler: async (ctx, { hostedWorkoutId }) => {
    const userId = await requireUser(ctx)
    return ctx.db
      .query('hostedWorkoutParticipants')
      .withIndex('by_hosted_workout_user', (q) =>
        q.eq('hostedWorkoutId', hostedWorkoutId).eq('userId', userId),
      )
      .first()
  },
})

export const getBySession = query({
  args: { sessionId: v.id('workoutSessions') },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUser(ctx)
    const participant = await ctx.db
      .query('hostedWorkoutParticipants')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .first()
    if (!participant || participant.userId !== userId) return null
    const hosted = await ctx.db.get(participant.hostedWorkoutId)
    if (!hosted) return null
    return { hosted: toHostedSessionDto(hosted) }
  },
})

export const listForHost = query({
  args: { hostedWorkoutId: v.id('hostedWorkouts') },
  handler: async (ctx, { hostedWorkoutId }) => {
    const hostUserId = await requireUser(ctx)
    const hosted = await ctx.db.get(hostedWorkoutId)
    if (!hosted || hosted.hostUserId !== hostUserId) throw new Error('Unauthorized')
    return ctx.db
      .query('hostedWorkoutParticipants')
      .withIndex('by_hosted_workout', (q) =>
        q.eq('hostedWorkoutId', hostedWorkoutId),
      )
      .collect()
  },
})
