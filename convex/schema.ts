import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  products: defineTable({
    title: v.string(),
    imageId: v.string(),
    price: v.number(),
  }),
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
  exercises: defineTable({
    name: v.string(),
    muscleGroups: v.array(v.string()),
    category: v.union(v.literal('compound'), v.literal('isolation')),
    equipment: v.union(
      v.literal('barbell'),
      v.literal('dumbbell'),
      v.literal('cable'),
      v.literal('bodyweight'),
      v.literal('machine'),
      v.literal('kettlebell'),
      v.literal('band'),
      v.literal('other'),
    ),
    notes: v.optional(v.string()),
    weightIncrement: v.optional(v.number()),
    isDefault: v.boolean(),
    userId: v.optional(v.string()),
  })
    .index('by_name', ['name'])
    .index('by_default', ['isDefault'])
    .index('by_user', ['userId']),

  workoutSessions: defineTable({
    userId: v.string(),
    date: v.number(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    name: v.optional(v.string()),
    routineId: v.optional(v.id('routines')),
    status: v.union(
      v.literal('active'),
      v.literal('completed'),
      v.literal('cancelled'),
    ),
  })
    .index('by_user', ['userId'])
    .index('by_user_status', ['userId', 'status'])
    .index('by_user_date', ['userId', 'date']),

  sets: defineTable({
    userId: v.string(),
    sessionId: v.id('workoutSessions'),
    exerciseId: v.id('exercises'),
    setNumber: v.number(),
    reps: v.number(),
    weight: v.optional(v.number()),
    unit: v.union(v.literal('kg'), v.literal('lbs')),
    rpe: v.optional(v.number()),
    setType: v.union(
      v.literal('warmup'),
      v.literal('working'),
      v.literal('drop'),
      v.literal('failure'),
    ),
    loggedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_exercise', ['exerciseId'])
    .index('by_user', ['userId'])
    .index('by_session_exercise', ['sessionId', 'exerciseId']),

  oneRepMaxes: defineTable({
    userId: v.string(),
    exerciseId: v.id('exercises'),
    value: v.number(),
    unit: v.union(v.literal('kg'), v.literal('lbs')),
    date: v.number(),
    source: v.union(
      v.literal('manual'),
      v.literal('calculated'),
      v.literal('actual'),
    ),
    formula: v.optional(v.string()),
  })
    .index('by_exercise', ['exerciseId'])
    .index('by_user', ['userId'])
    .index('by_user_exercise', ['userId', 'exerciseId']),

  routines: defineTable({
    userId: v.string(),
    name: v.string(),
    exercises: v.array(
      v.object({
        exerciseId: v.id('exercises'),
        defaultSets: v.number(),
        defaultReps: v.number(),
        defaultWeight: v.optional(v.number()),
      }),
    ),
  }).index('by_user', ['userId']),
})
