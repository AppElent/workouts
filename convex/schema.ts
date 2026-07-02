import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
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
    instructions: v.optional(v.array(v.string())),
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
    weight: v.number(),
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
    .index('by_user_exercise', ['userId', 'exerciseId'])
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

  bodyMetrics: defineTable({
    userId: v.string(),
    date: v.number(),
    weight: v.optional(v.number()),
    unit: v.union(v.literal('kg'), v.literal('lbs')),
    bodyFatPct: v.optional(v.number()),
    measurements: v.optional(
      v.object({
        chest: v.optional(v.number()),
        waist: v.optional(v.number()),
        arms: v.optional(v.number()),
        thighs: v.optional(v.number()),
      }),
    ),
    notes: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_user_date', ['userId', 'date']),

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

  wods: defineTable({
    userId: v.string(),
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
    movements: v.array(
      v.object({
        name: v.string(),
        reps: v.optional(v.number()),
        weight: v.optional(v.number()),
        unit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
        distance: v.optional(v.number()),
        distanceUnit: v.optional(
          v.union(
            v.literal('m'),
            v.literal('km'),
            v.literal('mi'),
            v.literal('cal'),
          ),
        ),
        notes: v.optional(v.string()),
      }),
    ),
    isDefault: v.boolean(),
  })
    .index('by_user', ['userId'])
    .index('by_default', ['isDefault'])
    .index('by_name', ['name']),

  wodResults: defineTable({
    userId: v.string(),
    wodId: v.id('wods'),
    sessionId: v.optional(v.id('workoutSessions')),
    date: v.number(),
    rxScaled: v.union(v.literal('rx'), v.literal('scaled')),
    timeSeconds: v.optional(v.number()),
    rounds: v.optional(v.number()),
    reps: v.optional(v.number()),
    timeCapped: v.optional(v.boolean()),
    load: v.optional(v.number()),
    loadUnit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
    notes: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_wod', ['wodId'])
    .index('by_user_wod', ['userId', 'wodId'])
    .index('by_session', ['sessionId']),

  hostedWorkouts: defineTable({
    hostUserId: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    status: v.union(
      v.literal('draft'),
      v.literal('open'),
      v.literal('closed'),
    ),
    joinToken: v.string(),
    hostParticipation: v.union(
      v.literal('hostOnly'),
      v.literal('hostAndParticipate'),
    ),
    createdAt: v.number(),
    openedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    template: v.object({
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
              level: v.union(
                v.literal('rx'),
                v.literal('l1'),
                v.literal('l2'),
                v.literal('l3'),
              ),
              label: v.string(),
              description: v.optional(v.string()),
              movements: v.array(
                v.object({
                  name: v.string(),
                  reps: v.optional(v.number()),
                  weight: v.optional(v.number()),
                  unit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
                  distance: v.optional(v.number()),
                  distanceUnit: v.optional(
                    v.union(
                      v.literal('m'),
                      v.literal('km'),
                      v.literal('mi'),
                      v.literal('cal'),
                    ),
                  ),
                  notes: v.optional(v.string()),
                }),
              ),
            }),
          ),
        }),
      ),
    }),
  })
    .index('by_host', ['hostUserId'])
    .index('by_status', ['status'])
    .index('by_join_token', ['joinToken']),

  hostedWorkoutParticipants: defineTable({
    hostedWorkoutId: v.id('hostedWorkouts'),
    userId: v.string(),
    sessionId: v.id('workoutSessions'),
    joinedAt: v.number(),
    displayName: v.optional(v.string()),
  })
    .index('by_hosted_workout', ['hostedWorkoutId'])
    .index('by_user', ['userId'])
    .index('by_hosted_workout_user', ['hostedWorkoutId', 'userId'])
    .index('by_session', ['sessionId']),

  hostedWorkoutSubmissions: defineTable({
    hostedWorkoutId: v.id('hostedWorkouts'),
    participantId: v.optional(v.id('hostedWorkoutParticipants')),
    guestName: v.optional(v.string()),
    wodBlockId: v.string(),
    level: v.union(
      v.literal('rx'),
      v.literal('l1'),
      v.literal('l2'),
      v.literal('l3'),
    ),
    timeSeconds: v.optional(v.number()),
    rounds: v.optional(v.number()),
    reps: v.optional(v.number()),
    timeCapped: v.optional(v.boolean()),
    load: v.optional(v.number()),
    loadUnit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
    notes: v.optional(v.string()),
    submittedAt: v.number(),
  })
    .index('by_hosted_workout', ['hostedWorkoutId'])
    .index('by_participant', ['participantId'])
    .index('by_hosted_workout_wod', ['hostedWorkoutId', 'wodBlockId']),
})
