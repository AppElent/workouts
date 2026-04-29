import { mutation } from './_generated/server'

export const seedExercises = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('exercises')
      .withIndex('by_default', (q) => q.eq('isDefault', true))
      .collect()
    if (existing.length > 0) return { seeded: false, reason: 'already seeded' }

    const exercises = [
      {
        name: 'Barbell Back Squat',
        muscleGroups: ['quadriceps', 'glutes', 'hamstrings'],
        category: 'compound' as const,
        equipment: 'barbell' as const,
        isDefault: true,
      },
      {
        name: 'Barbell Bench Press',
        muscleGroups: ['chest', 'triceps', 'shoulders'],
        category: 'compound' as const,
        equipment: 'barbell' as const,
        isDefault: true,
      },
      {
        name: 'Barbell Deadlift',
        muscleGroups: ['hamstrings', 'glutes', 'back', 'traps'],
        category: 'compound' as const,
        equipment: 'barbell' as const,
        isDefault: true,
      },
      {
        name: 'Barbell Overhead Press',
        muscleGroups: ['shoulders', 'triceps'],
        category: 'compound' as const,
        equipment: 'barbell' as const,
        isDefault: true,
      },
      {
        name: 'Barbell Row',
        muscleGroups: ['back', 'biceps', 'rear delts'],
        category: 'compound' as const,
        equipment: 'barbell' as const,
        isDefault: true,
      },
      {
        name: 'Pull-Up',
        muscleGroups: ['back', 'biceps'],
        category: 'compound' as const,
        equipment: 'bodyweight' as const,
        isDefault: true,
      },
      {
        name: 'Dumbbell Curl',
        muscleGroups: ['biceps'],
        category: 'isolation' as const,
        equipment: 'dumbbell' as const,
        isDefault: true,
      },
      {
        name: 'Tricep Pushdown',
        muscleGroups: ['triceps'],
        category: 'isolation' as const,
        equipment: 'cable' as const,
        isDefault: true,
      },
      {
        name: 'Leg Press',
        muscleGroups: ['quadriceps', 'glutes'],
        category: 'compound' as const,
        equipment: 'machine' as const,
        isDefault: true,
      },
      {
        name: 'Romanian Deadlift',
        muscleGroups: ['hamstrings', 'glutes'],
        category: 'compound' as const,
        equipment: 'barbell' as const,
        isDefault: true,
      },
      {
        name: 'Dumbbell Lateral Raise',
        muscleGroups: ['shoulders'],
        category: 'isolation' as const,
        equipment: 'dumbbell' as const,
        isDefault: true,
      },
      {
        name: 'Cable Row',
        muscleGroups: ['back', 'biceps'],
        category: 'compound' as const,
        equipment: 'cable' as const,
        isDefault: true,
      },
      {
        name: 'Dumbbell Bench Press',
        muscleGroups: ['chest', 'triceps', 'shoulders'],
        category: 'compound' as const,
        equipment: 'dumbbell' as const,
        isDefault: true,
      },
      {
        name: 'Incline Barbell Press',
        muscleGroups: ['chest', 'shoulders', 'triceps'],
        category: 'compound' as const,
        equipment: 'barbell' as const,
        isDefault: true,
      },
      {
        name: 'Kettlebell Swing',
        muscleGroups: ['glutes', 'hamstrings', 'core'],
        category: 'compound' as const,
        equipment: 'kettlebell' as const,
        isDefault: true,
      },
    ]

    for (const exercise of exercises) {
      await ctx.db.insert('exercises', exercise)
    }

    return { seeded: true, count: exercises.length }
  },
})
