import { query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx } from './_generated/server'

async function requireUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

export const weeklyVolume = query({
  args: { exerciseId: v.id('exercises') },
  handler: async (ctx, { exerciseId }) => {
    const userId = await requireUser(ctx)
    const sets = (
      await ctx.db
        .query('sets')
        .withIndex('by_exercise', (q) => q.eq('exerciseId', exerciseId))
        .collect()
    ).filter((s) => s.userId === userId)
    const weekMap = new Map<string, number>()
    for (const set of sets) {
      const date = new Date(set.loggedAt)
      const thursday = new Date(date)
      thursday.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
      const yearStart = new Date(thursday.getFullYear(), 0, 4)
      const week =
        1 +
        Math.round(
          ((thursday.getTime() - yearStart.getTime()) / 86400000 -
            3 +
            ((yearStart.getDay() + 6) % 7)) /
            7,
        )
      const year = thursday.getFullYear()
      const key = `${year}-W${String(week).padStart(2, '0')}`
      weekMap.set(key, (weekMap.get(key) ?? 0) + set.weight * set.reps)
    }
    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, volume]) => ({ week, volume: Math.round(volume) }))
  },
})
