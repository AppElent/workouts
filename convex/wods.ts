import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

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

const wodFields = {
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
  movements: v.array(movement),
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    const defaults = await ctx.db
      .query('wods')
      .withIndex('by_default', (q) => q.eq('isDefault', true))
      .collect()
    if (!identity) {
      return defaults.sort((a, b) => a.name.localeCompare(b.name))
    }
    const userWods = await ctx.db
      .query('wods')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect()
    return [...defaults, ...userWods].sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  },
})

export const getById = query({
  args: { id: v.id('wods') },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity()
    const wod = await ctx.db.get(id)
    if (!wod) return null
    if (wod.isDefault) return wod
    if (!identity || wod.userId !== identity.subject) return null
    return wod
  },
})

export const create = mutation({
  args: wodFields,
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    return ctx.db.insert('wods', { ...args, isDefault: false, userId })
  },
})

export const update = mutation({
  args: { id: v.id('wods'), ...wodFields },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await requireUser(ctx)
    const wod = await ctx.db.get(id)
    if (!wod) throw new Error('WOD not found')
    if (wod.isDefault) throw new Error('Cannot edit benchmark WODs')
    if (wod.userId !== userId) throw new Error('Unauthorized')
    await ctx.db.patch(id, fields)
  },
})

export const remove = mutation({
  args: { id: v.id('wods') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const wod = await ctx.db.get(id)
    if (!wod) throw new Error('WOD not found')
    if (wod.isDefault) throw new Error('Cannot delete benchmark WODs')
    if (wod.userId !== userId) throw new Error('Unauthorized')
    const results = await ctx.db
      .query('wodResults')
      .withIndex('by_wod', (q) => q.eq('wodId', id))
      .collect()
    for (const r of results) {
      if (r.userId === userId) await ctx.db.delete(r._id)
    }
    await ctx.db.delete(id)
  },
})
