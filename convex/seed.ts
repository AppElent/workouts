// SEED MAINTENANCE: When adding new tables or features, update this file:
//   - seedExercises: add new default exercises if the exercise library grows
//   - seedTestData: add inserts for any new tables with per-user data
//   - clearUserData: add delete queries for any new per-user tables
//   - Schema additions: check for new required fields on existing tables

import { internalMutation, mutation } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { calculateOneRepMax } from './lib/oneRepMax'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function deleteUserData(ctx: MutationCtx, userId: string): Promise<void> {
	const sessions = await ctx.db
		.query('workoutSessions')
		.withIndex('by_user', (q) => q.eq('userId', userId))
		.collect()
	for (const session of sessions) {
		const sets = await ctx.db
			.query('sets')
			.withIndex('by_session', (q) => q.eq('sessionId', session._id))
			.collect()
		for (const set of sets) await ctx.db.delete(set._id)
		await ctx.db.delete(session._id)
	}
	const orms = await ctx.db
		.query('oneRepMaxes')
		.withIndex('by_user', (q) => q.eq('userId', userId))
		.collect()
	for (const orm of orms) await ctx.db.delete(orm._id)
	const routines = await ctx.db
		.query('routines')
		.withIndex('by_user', (q) => q.eq('userId', userId))
		.collect()
	for (const routine of routines) await ctx.db.delete(routine._id)
}

async function getExerciseId(ctx: MutationCtx, name: string): Promise<Id<'exercises'>> {
	const ex = await ctx.db
		.query('exercises')
		.withIndex('by_name', (q) => q.eq('name', name))
		.first()
	if (!ex) throw new Error(`Exercise not found: ${name}. Run seed:exercises first.`)
	return ex._id
}

// ─── seedExercises ───────────────────────────────────────────────────────────

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
				weightIncrement: 2.5,
			},
			{
				name: 'Barbell Bench Press',
				muscleGroups: ['chest', 'triceps', 'shoulders'],
				category: 'compound' as const,
				equipment: 'barbell' as const,
				isDefault: true,
				weightIncrement: 2.5,
			},
			{
				name: 'Barbell Deadlift',
				muscleGroups: ['hamstrings', 'glutes', 'back', 'traps'],
				category: 'compound' as const,
				equipment: 'barbell' as const,
				isDefault: true,
				weightIncrement: 2.5,
			},
			{
				name: 'Barbell Overhead Press',
				muscleGroups: ['shoulders', 'triceps'],
				category: 'compound' as const,
				equipment: 'barbell' as const,
				isDefault: true,
				weightIncrement: 1.25,
			},
			{
				name: 'Barbell Row',
				muscleGroups: ['back', 'biceps', 'rear delts'],
				category: 'compound' as const,
				equipment: 'barbell' as const,
				isDefault: true,
				weightIncrement: 2.5,
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
				weightIncrement: 2,
			},
			{
				name: 'Tricep Pushdown',
				muscleGroups: ['triceps'],
				category: 'isolation' as const,
				equipment: 'cable' as const,
				isDefault: true,
				weightIncrement: 2.5,
			},
			{
				name: 'Leg Press',
				muscleGroups: ['quadriceps', 'glutes'],
				category: 'compound' as const,
				equipment: 'machine' as const,
				isDefault: true,
				weightIncrement: 5,
			},
			{
				name: 'Romanian Deadlift',
				muscleGroups: ['hamstrings', 'glutes'],
				category: 'compound' as const,
				equipment: 'barbell' as const,
				isDefault: true,
				weightIncrement: 2.5,
			},
			{
				name: 'Dumbbell Lateral Raise',
				muscleGroups: ['shoulders'],
				category: 'isolation' as const,
				equipment: 'dumbbell' as const,
				isDefault: true,
				weightIncrement: 2,
			},
			{
				name: 'Cable Row',
				muscleGroups: ['back', 'biceps'],
				category: 'compound' as const,
				equipment: 'cable' as const,
				isDefault: true,
				weightIncrement: 2.5,
			},
			{
				name: 'Dumbbell Bench Press',
				muscleGroups: ['chest', 'triceps', 'shoulders'],
				category: 'compound' as const,
				equipment: 'dumbbell' as const,
				isDefault: true,
				weightIncrement: 2,
			},
			{
				name: 'Incline Barbell Press',
				muscleGroups: ['chest', 'shoulders', 'triceps'],
				category: 'compound' as const,
				equipment: 'barbell' as const,
				isDefault: true,
				weightIncrement: 2.5,
			},
			{
				name: 'Kettlebell Swing',
				muscleGroups: ['glutes', 'hamstrings', 'core'],
				category: 'compound' as const,
				equipment: 'kettlebell' as const,
				isDefault: true,
				weightIncrement: 4,
			},
		]

		for (const exercise of exercises) {
			await ctx.db.insert('exercises', exercise)
		}

		return { seeded: true, count: exercises.length }
	},
})

// ─── clearUserData ───────────────────────────────────────────────────────────

export const clearUserData = internalMutation({
	args: { userId: v.string() },
	handler: async (ctx, { userId }) => {
		await deleteUserData(ctx, userId)
		return { cleared: true }
	},
})

// ─── seedTestData ────────────────────────────────────────────────────────────

export const seedTestData = internalMutation({
	args: { userId: v.string() },
	handler: async (ctx, { userId }) => {
		await deleteUserData(ctx, userId)

		const exIds = {
			squat: await getExerciseId(ctx, 'Barbell Back Squat'),
			bench: await getExerciseId(ctx, 'Barbell Bench Press'),
			deadlift: await getExerciseId(ctx, 'Barbell Deadlift'),
			ohp: await getExerciseId(ctx, 'Barbell Overhead Press'),
			row: await getExerciseId(ctx, 'Barbell Row'),
			pullUp: await getExerciseId(ctx, 'Pull-Up'),
			curl: await getExerciseId(ctx, 'Dumbbell Curl'),
			tricepPush: await getExerciseId(ctx, 'Tricep Pushdown'),
			legPress: await getExerciseId(ctx, 'Leg Press'),
			rdl: await getExerciseId(ctx, 'Romanian Deadlift'),
			latRaise: await getExerciseId(ctx, 'Dumbbell Lateral Raise'),
			cableRow: await getExerciseId(ctx, 'Cable Row'),
			dbBench: await getExerciseId(ctx, 'Dumbbell Bench Press'),
			inclineBench: await getExerciseId(ctx, 'Incline Barbell Press'),
			kbSwing: await getExerciseId(ctx, 'Kettlebell Swing'),
		}

		// Routines
		const pushId = await ctx.db.insert('routines', {
			userId,
			name: 'Push Day',
			exercises: [
				{ exerciseId: exIds.bench, defaultSets: 4, defaultReps: 5, defaultWeight: 80 },
				{ exerciseId: exIds.ohp, defaultSets: 3, defaultReps: 8, defaultWeight: 50 },
				{ exerciseId: exIds.inclineBench, defaultSets: 3, defaultReps: 8, defaultWeight: 65 },
				{ exerciseId: exIds.dbBench, defaultSets: 3, defaultReps: 10, defaultWeight: 30 },
				{ exerciseId: exIds.tricepPush, defaultSets: 3, defaultReps: 12, defaultWeight: 30 },
				{ exerciseId: exIds.latRaise, defaultSets: 3, defaultReps: 15, defaultWeight: 10 },
			],
		})

		const pullId = await ctx.db.insert('routines', {
			userId,
			name: 'Pull Day',
			exercises: [
				{ exerciseId: exIds.deadlift, defaultSets: 3, defaultReps: 5, defaultWeight: 120 },
				{ exerciseId: exIds.row, defaultSets: 4, defaultReps: 6, defaultWeight: 70 },
				{ exerciseId: exIds.pullUp, defaultSets: 3, defaultReps: 8, defaultWeight: 0 },
				{ exerciseId: exIds.cableRow, defaultSets: 3, defaultReps: 10, defaultWeight: 55 },
				{ exerciseId: exIds.curl, defaultSets: 3, defaultReps: 12, defaultWeight: 14 },
			],
		})

		const legId = await ctx.db.insert('routines', {
			userId,
			name: 'Leg Day',
			exercises: [
				{ exerciseId: exIds.squat, defaultSets: 4, defaultReps: 5, defaultWeight: 100 },
				{ exerciseId: exIds.legPress, defaultSets: 3, defaultReps: 10, defaultWeight: 150 },
				{ exerciseId: exIds.rdl, defaultSets: 3, defaultReps: 8, defaultWeight: 80 },
				{ exerciseId: exIds.kbSwing, defaultSets: 3, defaultReps: 15, defaultWeight: 24 },
			],
		})

		// Timestamp helper
		const DAY = 24 * 60 * 60 * 1000
		const now = Date.now()
		function sessionTs(daysAgo: number) {
			const d = now - daysAgo * DAY
			const midnight = d - (d % DAY)
			const start = midnight + 18 * 60 * 60 * 1000
			return { start, end: start + 75 * 60 * 1000 }
		}

		// Push day weights per appearance index (0–3)
		const pushWeights = [
			[77.5, 47.5, 62.5, 28, 27.5, 8],
			[80, 48.75, 65, 30, 30, 10],
			[82.5, 50, 67.5, 30, 30, 10],
			[85, 51.25, 70, 32, 32.5, 10],
		]
		const pushExercises = [
			{ id: exIds.bench, reps: 5, sets: 4 },
			{ id: exIds.ohp, reps: 8, sets: 3 },
			{ id: exIds.inclineBench, reps: 8, sets: 3 },
			{ id: exIds.dbBench, reps: 10, sets: 3 },
			{ id: exIds.tricepPush, reps: 12, sets: 3 },
			{ id: exIds.latRaise, reps: 15, sets: 3 },
		]

		// Pull day weights per appearance index (0–2)
		const pullWeights = [
			[117.5, 67.5, 0, 52.5, 12],
			[120, 70, 0, 55, 14],
			[122.5, 72.5, 0, 57.5, 14],
		]
		const pullExercises = [
			{ id: exIds.deadlift, reps: 5, sets: 3 },
			{ id: exIds.row, reps: 6, sets: 4 },
			{ id: exIds.pullUp, reps: 8, sets: 3 },
			{ id: exIds.cableRow, reps: 10, sets: 3 },
			{ id: exIds.curl, reps: 12, sets: 3 },
		]

		// Leg day weights per appearance index (0–2)
		const legWeights = [
			[97.5, 145, 77.5, 20],
			[100, 150, 80, 24],
			[102.5, 155, 82.5, 24],
		]
		const legExercises = [
			{ id: exIds.squat, reps: 5, sets: 4 },
			{ id: exIds.legPress, reps: 10, sets: 3 },
			{ id: exIds.rdl, reps: 8, sets: 3 },
			{ id: exIds.kbSwing, reps: 15, sets: 3 },
		]

		type BestSet = { weight: number; reps: number }
		const bestSets = new Map<Id<'exercises'>, BestSet>()

		function trackBest(exerciseId: Id<'exercises'>, weight: number, reps: number) {
			if (weight === 0) return
			const existing = bestSets.get(exerciseId)
			if (!existing) {
				bestSets.set(exerciseId, { weight, reps })
				return
			}
			const newOrm = calculateOneRepMax(weight, reps).value
			const oldOrm = calculateOneRepMax(existing.weight, existing.reps).value
			if (newOrm > oldOrm) bestSets.set(exerciseId, { weight, reps })
		}

		async function insertSets(
			sessionId: Id<'workoutSessions'>,
			sessionStart: number,
			exercises: { id: Id<'exercises'>; reps: number; sets: number }[],
			weights: number[],
		) {
			let setIndex = 0
			for (let ei = 0; ei < exercises.length; ei++) {
				const ex = exercises[ei]
				const weight = weights[ei]
				for (let s = 0; s < ex.sets; s++) {
					await ctx.db.insert('sets', {
						userId,
						sessionId,
						exerciseId: ex.id,
						setNumber: s + 1,
						reps: ex.reps,
						weight,
						unit: 'kg',
						setType: 'working',
						loggedAt: sessionStart + setIndex * 3 * 60 * 1000,
					})
					trackBest(ex.id, weight, ex.reps)
					setIndex++
				}
			}
			return setIndex
		}

		// Sessions
		const schedule = [
			{ daysAgo: 28, type: 'push', idx: 0 },
			{ daysAgo: 26, type: 'pull', idx: 0 },
			{ daysAgo: 24, type: 'legs', idx: 0 },
			{ daysAgo: 21, type: 'push', idx: 1 },
			{ daysAgo: 19, type: 'pull', idx: 1 },
			{ daysAgo: 17, type: 'legs', idx: 1 },
			{ daysAgo: 14, type: 'push', idx: 2 },
			{ daysAgo: 12, type: 'pull', idx: 2 },
			{ daysAgo: 10, type: 'legs', idx: 2 },
			{ daysAgo: 7, type: 'push', idx: 3 },
		] as const

		let totalSets = 0

		for (const s of schedule) {
			const ts = sessionTs(s.daysAgo)
			let routineId: Id<'routines'>
			let name: string
			if (s.type === 'push') {
				routineId = pushId
				name = 'Push Day'
			} else if (s.type === 'pull') {
				routineId = pullId
				name = 'Pull Day'
			} else {
				routineId = legId
				name = 'Leg Day'
			}

			const sessionId = await ctx.db.insert('workoutSessions', {
				userId,
				date: ts.start,
				startTime: ts.start,
				endTime: ts.end,
				name,
				routineId,
				status: 'completed',
			})

			if (s.type === 'push') {
				totalSets += await insertSets(sessionId, ts.start, pushExercises, pushWeights[s.idx])
			} else if (s.type === 'pull') {
				totalSets += await insertSets(sessionId, ts.start, pullExercises, pullWeights[s.idx])
			} else {
				totalSets += await insertSets(sessionId, ts.start, legExercises, legWeights[s.idx])
			}
		}

		// 1RMs from best sets
		let ormCount = 0
		for (const [exerciseId, best] of bestSets.entries()) {
			const result = calculateOneRepMax(best.weight, best.reps)
			await ctx.db.insert('oneRepMaxes', {
				userId,
				exerciseId,
				value: result.value,
				unit: 'kg',
				date: now,
				source: result.source,
				formula: result.formula,
			})
			ormCount++
		}

		return { seeded: true, routines: 3, sessions: 10, sets: totalSets, oneRepMaxes: ormCount }
	},
})
