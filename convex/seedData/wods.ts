export interface SeedMovement {
  name: string
  reps?: number
  weight?: number
  unit?: 'kg' | 'lbs'
  distance?: number
  distanceUnit?: 'm' | 'km' | 'mi' | 'cal'
  notes?: string
}

export interface SeedWod {
  name: string
  type: 'forTime' | 'amrap' | 'emom' | 'load'
  description?: string
  repScheme?: string
  timeCapSeconds?: number
  durationSeconds?: number
  movements: SeedMovement[]
}

export const DEFAULT_WODS: SeedWod[] = [
  {
    name: 'Fran',
    type: 'forTime',
    repScheme: '21-15-9',
    description: '21-15-9 reps for time of Thrusters and Pull-ups.',
    movements: [
      { name: 'Thruster', weight: 43, unit: 'kg' },
      { name: 'Pull-up' },
    ],
  },
  {
    name: 'Cindy',
    type: 'amrap',
    durationSeconds: 20 * 60,
    description:
      'AMRAP in 20 minutes: 5 Pull-ups, 10 Push-ups, 15 Air Squats.',
    movements: [
      { name: 'Pull-up', reps: 5 },
      { name: 'Push-up', reps: 10 },
      { name: 'Air Squat', reps: 15 },
    ],
  },
  {
    name: 'Helen',
    type: 'forTime',
    repScheme: '3 rounds',
    description:
      '3 rounds for time: 400m Run, 21 Kettlebell Swings, 12 Pull-ups.',
    movements: [
      { name: 'Run', distance: 400, distanceUnit: 'm' },
      { name: 'Kettlebell Swing', reps: 21, weight: 24, unit: 'kg' },
      { name: 'Pull-up', reps: 12 },
    ],
  },
  {
    name: 'Grace',
    type: 'forTime',
    repScheme: '30 reps',
    description: '30 Clean & Jerks for time.',
    movements: [{ name: 'Clean and Jerk', reps: 30, weight: 61, unit: 'kg' }],
  },
  {
    name: 'Annie',
    type: 'forTime',
    repScheme: '50-40-30-20-10',
    description:
      '50-40-30-20-10 reps for time of Double-unders and Sit-ups.',
    movements: [{ name: 'Double-under' }, { name: 'Sit-up' }],
  },
  {
    name: 'Diane',
    type: 'forTime',
    repScheme: '21-15-9',
    description: '21-15-9 reps for time of Deadlifts and Handstand Push-ups.',
    movements: [
      { name: 'Deadlift', weight: 102, unit: 'kg' },
      { name: 'Handstand Push-up' },
    ],
  },
  {
    name: 'Karen',
    type: 'forTime',
    repScheme: '150 reps',
    description: '150 Wall Balls for time.',
    movements: [{ name: 'Wall Ball', reps: 150, weight: 9, unit: 'kg' }],
  },
  {
    name: 'Murph',
    type: 'forTime',
    description:
      'For time: 1 mile Run, 100 Pull-ups, 200 Push-ups, 300 Air Squats, 1 mile Run. Partition as needed.',
    movements: [
      { name: 'Run', distance: 1, distanceUnit: 'mi' },
      { name: 'Pull-up', reps: 100 },
      { name: 'Push-up', reps: 200 },
      { name: 'Air Squat', reps: 300 },
      { name: 'Run', distance: 1, distanceUnit: 'mi' },
    ],
  },
]
