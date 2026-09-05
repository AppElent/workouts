import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

const nutrient = v.union(v.literal('energy'), v.literal('protein'), v.literal('carbs'), v.literal('fat'), v.literal('saturatedFat'), v.literal('fibre'), v.literal('sugars'), v.literal('salt'))
const direction = v.union(v.literal('min'), v.literal('max'))
const preset = v.union(v.literal('reference'), v.literal('loseWeight'), v.literal('buildMuscle'))
const goal = v.object({ nutrient, direction, target: v.number(), sourcePreset: v.optional(preset) })

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx)
    return ctx.db.query('nutritionGoals').withIndex('by_user', (q) => q.eq('userId', userId)).collect()
  },
})

export const replace = mutation({
  args: { goals: v.array(goal) },
  handler: async (ctx, { goals }) => {
    const userId = await requireUser(ctx)
    const keys = new Set<string>()
    for (const item of goals) {
      if (!Number.isFinite(item.target) || item.target <= 0 || item.target > 100000) throw new Error('Goal must be greater than zero.')
      const key = `${item.nutrient}:${item.direction}`
      if (keys.has(key)) throw new Error('Goals contain a duplicate nutrient bound.')
      keys.add(key)
    }
    const existing = await ctx.db.query('nutritionGoals').withIndex('by_user', (q) => q.eq('userId', userId)).collect()
    for (const row of existing) await ctx.db.delete(row._id)
    for (const item of goals) await ctx.db.insert('nutritionGoals', { userId, ...item })
  },
})
