# CrossFit WOD Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CrossFit WOD logging — define WODs (For Time / AMRAP / EMOM / Load) with structured movements, log results against them standalone or inside a workout session, and compare results over time.

**Architecture:** Two new Convex tables (`wods` definitions + `wodResults` attempts) kept fully separate from the existing `sets`/`exercises`/1RM machinery. A pure scoring module (`wodScore.ts`, mirrored client + server) formats and ranks results so a single comparator drives PR detection and history charts. New `/wods` library + `/wods/$id` detail routes, plus an "Add WOD" affordance on the active session page.

**Tech Stack:** Convex (queries/mutations), React 19 + TanStack Router (file-based routes), Tailwind v4, Recharts, Lucide, Vitest, Biome.

**Prerequisites / conventions:**
- Branch `feat/crossfit-wod-logging` is checked out.
- Keep `npm run dev:all` (or at least `npx convex dev`) running while implementing Convex tasks — it pushes the schema and regenerates `convex/_generated/api` so the frontend `api.wods.*` / `api.wodResults.*` references typecheck.
- Adding route files requires the dev server (TanStack Router) running so `src/routeTree.gen.ts` regenerates. **Never edit `routeTree.gen.ts` by hand.**
- `convex/` files use single quotes + 2-space indent; `src/` files use double quotes + tabs. Run `npm run format` after editing so Biome normalizes whitespace; run `npm run check` to lint.

---

### Task 1: Schema — `wods` and `wodResults` tables

**Files:**
- Modify: `convex/schema.ts` (add two tables to the `defineSchema({...})` object, after the `routines` table)

- [ ] **Step 1: Add the two tables**

In `convex/schema.ts`, insert these two table definitions inside the `defineSchema({ ... })` object, immediately after the `routines: defineTable({...}).index('by_user', ['userId']),` entry:

```ts
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
```

- [ ] **Step 2: Verify the schema pushes**

With `npx convex dev` running, watch its output. Expected: schema validates and pushes with no errors; `convex/_generated/dataModel.d.ts` now includes `wods` and `wodResults`.

Run: `npm run format`

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add wods and wodResults tables"
```

---

### Task 2: Client scoring module `src/lib/wodScore.ts` (TDD)

This is the comparator brain: format a score for display and rank scores so higher = better across all four types. Pure functions — written test-first.

**Files:**
- Create: `src/lib/wodScore.ts`
- Test: `src/lib/wodScore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/wodScore.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bestScore, formatScore, formatSeconds, scoreRank } from "./wodScore";

describe("formatSeconds", () => {
	it("formats mm:ss with zero-padded seconds", () => {
		expect(formatSeconds(0)).toBe("0:00");
		expect(formatSeconds(9)).toBe("0:09");
		expect(formatSeconds(201)).toBe("3:21");
	});
});

describe("formatScore", () => {
	it("For Time: finish shows mm:ss, capped shows CAP+reps", () => {
		expect(formatScore("forTime", { timeSeconds: 201 })).toBe("3:21");
		expect(formatScore("forTime", { timeCapped: true, reps: 12 })).toBe(
			"CAP+12",
		);
	});
	it("AMRAP shows rounds + reps", () => {
		expect(formatScore("amrap", { rounds: 6, reps: 14 })).toBe("6 + 14");
	});
	it("EMOM shows total reps", () => {
		expect(formatScore("emom", { reps: 180 })).toBe("180 reps");
	});
	it("Load shows weight + unit", () => {
		expect(formatScore("load", { load: 95, loadUnit: "kg" })).toBe("95 kg");
	});
});

describe("scoreRank", () => {
	it("For Time: faster ranks higher", () => {
		expect(scoreRank("forTime", { timeSeconds: 180 })).toBeGreaterThan(
			scoreRank("forTime", { timeSeconds: 240 }),
		);
	});
	it("For Time: any finish beats any cap", () => {
		const slowFinish = scoreRank("forTime", { timeSeconds: 3600 });
		const goodCap = scoreRank("forTime", { timeCapped: true, reps: 500 });
		expect(slowFinish).toBeGreaterThan(goodCap);
	});
	it("For Time: among capped, more reps ranks higher", () => {
		expect(scoreRank("forTime", { timeCapped: true, reps: 30 })).toBeGreaterThan(
			scoreRank("forTime", { timeCapped: true, reps: 20 }),
		);
	});
	it("AMRAP: more rounds wins even with fewer extra reps", () => {
		expect(scoreRank("amrap", { rounds: 7, reps: 0 })).toBeGreaterThan(
			scoreRank("amrap", { rounds: 6, reps: 99 }),
		);
	});
	it("Load: normalizes lbs to kg for comparison", () => {
		// 225 lbs ≈ 102 kg, beats a 100 kg lift
		expect(scoreRank("load", { load: 225, loadUnit: "lbs" })).toBeGreaterThan(
			scoreRank("load", { load: 100, loadUnit: "kg" }),
		);
	});
});

describe("bestScore", () => {
	it("returns null for empty input", () => {
		expect(bestScore("forTime", [])).toBeNull();
	});
	it("returns the fastest For Time result", () => {
		const a = { _id: "a", timeSeconds: 200 };
		const b = { _id: "b", timeSeconds: 150 };
		expect(bestScore("forTime", [a, b])).toBe(b);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/wodScore.test.ts`
Expected: FAIL — cannot find module `./wodScore` / functions not defined.

- [ ] **Step 3: Write the implementation**

Create `src/lib/wodScore.ts`:

```ts
export type WodType = "forTime" | "amrap" | "emom" | "load";

export interface WodScoreInput {
	timeSeconds?: number;
	rounds?: number;
	reps?: number;
	timeCapped?: boolean;
	load?: number;
	loadUnit?: "kg" | "lbs";
}

const KG_PER_LB = 0.45359237;
// Capped For-Time results always rank below any finished result.
const CAP_OFFSET = 1_000_000_000;
// Assumes a single AMRAP round never exceeds this many reps.
const AMRAP_ROUND_MULT = 100_000;

export function formatSeconds(totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const m = Math.floor(safe / 60);
	const s = safe % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatScore(type: WodType, score: WodScoreInput): string {
	switch (type) {
		case "forTime":
			if (score.timeCapped) return `CAP+${score.reps ?? 0}`;
			return formatSeconds(score.timeSeconds ?? 0);
		case "amrap":
			return `${score.rounds ?? 0} + ${score.reps ?? 0}`;
		case "emom":
			return `${score.reps ?? 0} reps`;
		case "load":
			return `${score.load ?? 0} ${score.loadUnit ?? "kg"}`;
	}
}

/** Higher = better, for every type. */
export function scoreRank(type: WodType, score: WodScoreInput): number {
	switch (type) {
		case "forTime":
			if (score.timeCapped) {
				// Below every finisher; more reps completed = better among capped.
				return -CAP_OFFSET + (score.reps ?? 0);
			}
			// Faster = higher rank (less negative).
			return -(score.timeSeconds ?? 0);
		case "amrap":
			return (score.rounds ?? 0) * AMRAP_ROUND_MULT + (score.reps ?? 0);
		case "emom":
			return score.reps ?? 0;
		case "load":
			return score.loadUnit === "lbs"
				? (score.load ?? 0) * KG_PER_LB
				: (score.load ?? 0);
	}
}

/** Returns the highest-ranked score, or null if the list is empty. */
export function bestScore<T extends WodScoreInput>(
	type: WodType,
	scores: T[],
): T | null {
	if (scores.length === 0) return null;
	let best = scores[0];
	let bestRank = scoreRank(type, best);
	for (const s of scores) {
		const r = scoreRank(type, s);
		if (r > bestRank) {
			best = s;
			bestRank = r;
		}
	}
	return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/wodScore.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/lib/wodScore.ts src/lib/wodScore.test.ts
git commit -m "feat: add WOD scoring/comparison module with tests"
```

---

### Task 3: Server scoring mirror `convex/lib/wodScore.ts`

Convex's `getBest` query needs the same comparator. Mirror it server-side (same pattern as the existing `src/lib/oneRepMax.ts` / `convex/lib/oneRepMax.ts` split). Keep in sync with Task 2.

**Files:**
- Create: `convex/lib/wodScore.ts`

- [ ] **Step 1: Create the server mirror**

Create `convex/lib/wodScore.ts` with the same content as `src/lib/wodScore.ts` from Task 2 (re-typed here in convex single-quote style; `formatScore`/`formatSeconds` are unused server-side but included so the two files stay identical and easy to diff):

```ts
export type WodType = 'forTime' | 'amrap' | 'emom' | 'load'

export interface WodScoreInput {
  timeSeconds?: number
  rounds?: number
  reps?: number
  timeCapped?: boolean
  load?: number
  loadUnit?: 'kg' | 'lbs'
}

const KG_PER_LB = 0.45359237
const CAP_OFFSET = 1_000_000_000
const AMRAP_ROUND_MULT = 100_000

export function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatScore(type: WodType, score: WodScoreInput): string {
  switch (type) {
    case 'forTime':
      if (score.timeCapped) return `CAP+${score.reps ?? 0}`
      return formatSeconds(score.timeSeconds ?? 0)
    case 'amrap':
      return `${score.rounds ?? 0} + ${score.reps ?? 0}`
    case 'emom':
      return `${score.reps ?? 0} reps`
    case 'load':
      return `${score.load ?? 0} ${score.loadUnit ?? 'kg'}`
  }
}

export function scoreRank(type: WodType, score: WodScoreInput): number {
  switch (type) {
    case 'forTime':
      if (score.timeCapped) {
        return -CAP_OFFSET + (score.reps ?? 0)
      }
      return -(score.timeSeconds ?? 0)
    case 'amrap':
      return (score.rounds ?? 0) * AMRAP_ROUND_MULT + (score.reps ?? 0)
    case 'emom':
      return score.reps ?? 0
    case 'load':
      return score.loadUnit === 'lbs'
        ? (score.load ?? 0) * KG_PER_LB
        : (score.load ?? 0)
  }
}

export function bestScore<T extends WodScoreInput>(
  type: WodType,
  scores: T[],
): T | null {
  if (scores.length === 0) return null
  let best = scores[0]
  let bestRank = scoreRank(type, best)
  for (const s of scores) {
    const r = scoreRank(type, s)
    if (r > bestRank) {
      best = s
      bestRank = r
    }
  }
  return best
}
```

- [ ] **Step 2: Verify it compiles**

With `npx convex dev` running, confirm no type/push errors.

Run: `npm run format`

- [ ] **Step 3: Commit**

```bash
git add convex/lib/wodScore.ts
git commit -m "feat: add server-side WOD scoring mirror"
```

---

### Task 4: Backend — `convex/wods.ts` (definition CRUD)

Mirrors `convex/exercises.ts`: defaults readable by everyone, user WODs owner-only. The `create` mutation doubles as the on-the-fly "quick create" used by the session flow (pass an empty `movements` array for a bare WOD).

**Files:**
- Create: `convex/wods.ts`

- [ ] **Step 1: Write the file**

Create `convex/wods.ts`:

```ts
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
```

- [ ] **Step 2: Verify push + types**

With `npx convex dev` running, confirm it pushes cleanly and `api.wods` appears in `convex/_generated/api.d.ts`.

Run: `npm run format`

- [ ] **Step 3: Commit**

```bash
git add convex/wods.ts
git commit -m "feat: add wods CRUD backend"
```

---

### Task 5: Backend — `convex/wodResults.ts` (logged attempts)

**Files:**
- Create: `convex/wodResults.ts`

- [ ] **Step 1: Write the file**

Create `convex/wodResults.ts`:

```ts
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { QueryCtx, MutationCtx } from './_generated/server'
import { bestScore } from './lib/wodScore'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

const scoreFields = {
  rxScaled: v.union(v.literal('rx'), v.literal('scaled')),
  timeSeconds: v.optional(v.number()),
  rounds: v.optional(v.number()),
  reps: v.optional(v.number()),
  timeCapped: v.optional(v.boolean()),
  load: v.optional(v.number()),
  loadUnit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
  notes: v.optional(v.string()),
}

export const log = mutation({
  args: {
    wodId: v.id('wods'),
    sessionId: v.optional(v.id('workoutSessions')),
    date: v.optional(v.number()),
    ...scoreFields,
  },
  handler: async (ctx, { wodId, sessionId, date, ...score }) => {
    const userId = await requireUser(ctx)
    const wod = await ctx.db.get(wodId)
    if (!wod) throw new Error('WOD not found')
    if (!wod.isDefault && wod.userId !== userId) throw new Error('Unauthorized')
    if (sessionId) {
      const session = await ctx.db.get(sessionId)
      if (!session || session.userId !== userId)
        throw new Error('Session not found')
    }
    return ctx.db.insert('wodResults', {
      userId,
      wodId,
      sessionId,
      date: date ?? Date.now(),
      ...score,
    })
  },
})

export const listForWod = query({
  args: { wodId: v.id('wods') },
  handler: async (ctx, { wodId }) => {
    const userId = await requireUser(ctx)
    const results = await ctx.db
      .query('wodResults')
      .withIndex('by_user_wod', (q) => q.eq('userId', userId).eq('wodId', wodId))
      .collect()
    return results.sort((a, b) => a.date - b.date)
  },
})

export const listForSession = query({
  args: { sessionId: v.id('workoutSessions') },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUser(ctx)
    const results = await ctx.db
      .query('wodResults')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .collect()
    return results.filter((r) => r.userId === userId)
  },
})

export const getBest = query({
  args: { wodId: v.id('wods') },
  handler: async (ctx, { wodId }) => {
    const userId = await requireUser(ctx)
    const wod = await ctx.db.get(wodId)
    if (!wod) return null
    const results = await ctx.db
      .query('wodResults')
      .withIndex('by_user_wod', (q) => q.eq('userId', userId).eq('wodId', wodId))
      .collect()
    return bestScore(wod.type, results)
  },
})

export const remove = mutation({
  args: { id: v.id('wodResults') },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx)
    const result = await ctx.db.get(id)
    if (!result || result.userId !== userId) throw new Error('Unauthorized')
    await ctx.db.delete(id)
  },
})
```

- [ ] **Step 2: Verify push + types**

With `npx convex dev` running, confirm it pushes cleanly and `api.wodResults` appears in generated types.

Run: `npm run format`

- [ ] **Step 3: Commit**

```bash
git add convex/wodResults.ts
git commit -m "feat: add wodResults logging backend"
```

---

### Task 6: Seed benchmark WODs

**Files:**
- Create: `convex/seedData/wods.ts`
- Modify: `convex/seed.ts` (add `seedWods` mutation; extend `deleteUserData` to clear per-user WOD data)

- [ ] **Step 1: Create the seed data**

Create `convex/seedData/wods.ts`:

```ts
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
```

- [ ] **Step 2: Add the `seedWods` mutation**

In `convex/seed.ts`, add this import near the existing `import { DEFAULT_EXERCISES } from './seedData/exercises'` line:

```ts
import { DEFAULT_WODS } from './seedData/wods'
```

Then add this exported mutation after the `seedExercises` mutation (it is idempotent by name, mirroring `seedExercises`):

```ts
export const seedWods = mutation({
	args: {},
	handler: async (ctx) => {
		let inserted = 0
		let skipped = 0
		for (const wod of DEFAULT_WODS) {
			const existing = await ctx.db
				.query('wods')
				.withIndex('by_name', (q) => q.eq('name', wod.name))
				.first()
			if (existing) {
				skipped++
				continue
			}
			await ctx.db.insert('wods', { ...wod, isDefault: true })
			inserted++
		}
		return { inserted, skipped, total: DEFAULT_WODS.length }
	},
})
```

- [ ] **Step 3: Extend `deleteUserData` to clear per-user WOD data**

In `convex/seed.ts`, inside the `deleteUserData` helper, add the following before the closing brace of the function (after the `routines` deletion loop). This keeps `clearUserData` / `seedTestData` correct per the SEED MAINTENANCE note at the top of the file:

```ts
	const wodResults = await ctx.db
		.query('wodResults')
		.withIndex('by_user', (q) => q.eq('userId', userId))
		.collect()
	for (const r of wodResults) await ctx.db.delete(r._id)
	const userWods = await ctx.db
		.query('wods')
		.withIndex('by_user', (q) => q.eq('userId', userId))
		.collect()
	for (const w of userWods) await ctx.db.delete(w._id)
```

- [ ] **Step 4: Run the seed and verify**

With `npx convex dev` running, run the seed from the Convex dashboard Functions tab (or CLI):

Run: `npx convex run seed:seedWods`
Expected: returns `{ inserted: 8, skipped: 0, total: 8 }` on first run; `{ inserted: 0, skipped: 8, total: 8 }` if run again.

Run: `npm run format`

- [ ] **Step 5: Commit**

```bash
git add convex/seedData/wods.ts convex/seed.ts
git commit -m "feat: seed benchmark WODs and clear WOD data on reset"
```

---

### Task 7: Navigation — add WODs to the nav (TDD)

**Files:**
- Modify: `src/components/navItems.ts`
- Test: `src/components/navItems.test.ts`

- [ ] **Step 1: Add a failing test**

In `src/components/navItems.test.ts`, add this test inside the `describe("NAV_ITEMS", ...)` block:

```ts
	it("includes a gated WODs item pointing at /wods", () => {
		const wods = NAV_ITEMS.find((i) => i.to === "/wods");
		expect(wods).toBeDefined();
		expect(wods?.gated).toBe(true);
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/navItems.test.ts`
Expected: FAIL — `wods` is undefined.

- [ ] **Step 3: Add the nav item**

In `src/components/navItems.ts`, add `Timer` to the lucide-react import (keep the list alphabetical-ish; just add it):

```ts
import {
	BookOpen,
	ClipboardList,
	Dumbbell,
	LayoutDashboard,
	type LucideIcon,
	Timer,
	TrendingUp,
	User,
} from "lucide-react";
```

Then add this entry to the `NAV_ITEMS` array, immediately after the `/routines` item:

```ts
	{
		to: "/wods",
		label: "WODs",
		shortLabel: "WODs",
		Icon: Timer,
		gated: true,
	},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/navItems.test.ts`
Expected: PASS — including the existing `marks only /exercises as public` test (the WODs item is gated, so the public-routes assertion is unaffected).

- [ ] **Step 5: Format and commit**

`Sidebar.tsx` and `BottomTabBar.tsx` both map over `NAV_ITEMS`, so WODs now appears in both navs automatically — no edits needed there.

```bash
npm run format
git add src/components/navItems.ts src/components/navItems.test.ts
git commit -m "feat: add WODs nav item"
```

---

### Task 8: WOD library route + card + create form

**Files:**
- Create: `src/components/wods/WodCard.tsx`
- Create: `src/components/wods/CreateWodForm.tsx`
- Create: `src/routes/wods/index.tsx`

- [ ] **Step 1: Create `WodCard.tsx`**

Create `src/components/wods/WodCard.tsx`:

```tsx
import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";

const TYPE_LABELS: Record<Doc<"wods">["type"], string> = {
	forTime: "For Time",
	amrap: "AMRAP",
	emom: "EMOM",
	load: "Load",
};

export function WodCard({ wod }: { wod: Doc<"wods"> }) {
	return (
		<Link
			to="/wods/$id"
			params={{ id: wod._id }}
			className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 hover:border-[var(--accent)]/40 transition-colors flex flex-col gap-2"
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm font-semibold text-white truncate">
					{wod.name}
				</span>
				<span className="shrink-0 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--accent-dim)] text-[var(--accent)]">
					{TYPE_LABELS[wod.type]}
				</span>
			</div>
			{wod.repScheme && (
				<span className="text-xs text-[var(--text-muted)]">
					{wod.repScheme}
				</span>
			)}
			<span className="text-xs text-[var(--text-muted)] truncate">
				{wod.movements.map((m) => m.name).join(", ")}
			</span>
		</Link>
	);
}
```

- [ ] **Step 2: Create `CreateWodForm.tsx`**

Create `src/components/wods/CreateWodForm.tsx`:

```tsx
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Plus, X } from "lucide-react";
import { useState } from "react";

type WodType = Doc<"wods">["type"];

interface MovementDraft {
	id: string;
	name: string;
	reps: string;
	weight: string;
}

const TYPES: { value: WodType; label: string }[] = [
	{ value: "forTime", label: "For Time" },
	{ value: "amrap", label: "AMRAP" },
	{ value: "emom", label: "EMOM" },
	{ value: "load", label: "Load" },
];

function newMovement(): MovementDraft {
	return { id: crypto.randomUUID(), name: "", reps: "", weight: "" };
}

export function CreateWodForm() {
	const createWod = useMutation(api.wods.create);

	const [name, setName] = useState("");
	const [type, setType] = useState<WodType>("forTime");
	const [repScheme, setRepScheme] = useState("");
	const [minutes, setMinutes] = useState("");
	const [description, setDescription] = useState("");
	const [movements, setMovements] = useState<MovementDraft[]>([newMovement()]);

	function updateMovement(id: string, patch: Partial<MovementDraft>) {
		setMovements((prev) =>
			prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
		);
	}
	function addMovement() {
		setMovements((prev) => [...prev, newMovement()]);
	}
	function removeMovement(id: string) {
		setMovements((prev) => prev.filter((m) => m.id !== id));
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const cleanMovements = movements
			.filter((m) => m.name.trim())
			.map((m) => ({
				name: m.name.trim(),
				reps: m.reps ? Number(m.reps) : undefined,
				weight: m.weight ? Number(m.weight) : undefined,
				unit: m.weight ? ("kg" as const) : undefined,
			}));
		if (!name.trim() || cleanMovements.length === 0) return;
		const mins = minutes ? Number(minutes) : undefined;
		await createWod({
			name: name.trim(),
			type,
			repScheme: repScheme.trim() || undefined,
			description: description.trim() || undefined,
			timeCapSeconds: type === "forTime" && mins ? mins * 60 : undefined,
			durationSeconds:
				(type === "amrap" || type === "emom") && mins ? mins * 60 : undefined,
			movements: cleanMovements,
		});
		setName("");
		setType("forTime");
		setRepScheme("");
		setMinutes("");
		setDescription("");
		setMovements([newMovement()]);
	}

	const inputCls =
		"h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

	return (
		<form
			onSubmit={(e) => void handleSubmit(e)}
			className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 flex flex-col gap-4"
		>
			<h2 className="text-sm font-semibold text-white">Create WOD</h2>

			<input
				type="text"
				placeholder="WOD name (e.g. Monday Metcon)"
				value={name}
				onChange={(e) => setName(e.target.value)}
				className={inputCls}
				required
			/>

			<div className="flex gap-2">
				{TYPES.map((t) => (
					<button
						key={t.value}
						type="button"
						onClick={() => setType(t.value)}
						className={[
							"flex-1 h-9 rounded-lg text-xs font-medium transition-all",
							type === t.value
								? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/50"
								: "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white",
						].join(" ")}
					>
						{t.label}
					</button>
				))}
			</div>

			<div className="flex gap-2">
				<input
					type="text"
					placeholder="Rep scheme (e.g. 21-15-9)"
					value={repScheme}
					onChange={(e) => setRepScheme(e.target.value)}
					className={`${inputCls} flex-1`}
				/>
				{type !== "load" && (
					<input
						type="number"
						min="0"
						placeholder={
							type === "forTime" ? "Time cap (min)" : "Duration (min)"
						}
						value={minutes}
						onChange={(e) => setMinutes(e.target.value)}
						className={`${inputCls} w-36`}
					/>
				)}
			</div>

			<textarea
				placeholder="Description / notes (optional)"
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				rows={2}
				className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
			/>

			<div className="flex flex-col gap-2">
				{movements.map((m) => (
					<div key={m.id} className="flex gap-2 items-center">
						<input
							type="text"
							placeholder="Movement"
							value={m.name}
							onChange={(e) => updateMovement(m.id, { name: e.target.value })}
							className={`${inputCls} flex-1`}
						/>
						<input
							type="number"
							placeholder="Reps"
							value={m.reps}
							onChange={(e) => updateMovement(m.id, { reps: e.target.value })}
							className={`${inputCls} w-20`}
						/>
						<input
							type="number"
							placeholder="kg"
							value={m.weight}
							onChange={(e) => updateMovement(m.id, { weight: e.target.value })}
							className={`${inputCls} w-20`}
						/>
						<button
							type="button"
							onClick={() => removeMovement(m.id)}
							className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors"
							aria-label="Remove movement"
						>
							<X size={14} />
						</button>
					</div>
				))}
				<button
					type="button"
					onClick={addMovement}
					className="flex items-center gap-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors self-start"
				>
					<Plus size={14} />
					Add Movement
				</button>
			</div>

			<div className="flex justify-end">
				<button
					type="submit"
					disabled={!name.trim()}
					className="px-5 py-2 rounded-full bg-[var(--accent)] text-black text-sm font-bold disabled:opacity-40 hover:bg-[var(--accent-hover)] transition-colors"
				>
					Save WOD
				</button>
			</div>
		</form>
	);
}
```

- [ ] **Step 3: Create the library route**

Create `src/routes/wods/index.tsx`:

```tsx
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { CreateWodForm } from "#/components/wods/CreateWodForm";
import { WodCard } from "#/components/wods/WodCard";

export const Route = createFileRoute("/wods/")({
	component: WodsPageGuarded,
});

function WodsPageGuarded() {
	return (
		<>
			<SignedIn>
				<WodsPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function WodsPage() {
	const wods = useQuery(api.wods.list) ?? [];
	const benchmarks = wods.filter((w) => w.isDefault);
	const mine = wods.filter((w) => !w.isDefault);

	return (
		<div className="p-4 sm:p-6 max-w-4xl mx-auto">
			<h1 className="text-2xl font-bold text-white mb-6">WODs</h1>

			{mine.length > 0 && (
				<section className="mb-8">
					<h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
						My WODs
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{mine.map((wod) => (
							<WodCard key={wod._id} wod={wod} />
						))}
					</div>
				</section>
			)}

			<section className="mb-8">
				<h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
					Benchmarks
				</h2>
				{benchmarks.length > 0 ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{benchmarks.map((wod) => (
							<WodCard key={wod._id} wod={wod} />
						))}
					</div>
				) : (
					<p className="text-[var(--text-muted)] text-sm">
						No benchmark WODs seeded yet.
					</p>
				)}
			</section>

			<CreateWodForm />
		</div>
	);
}
```

- [ ] **Step 4: Verify in the browser**

With `npm run dev:all` running, navigate to `/wods`. Expected: the 8 seeded benchmarks render as cards; the "Create WOD" form works (create one and see it appear under "My WODs"). `src/routeTree.gen.ts` regenerated automatically — do not edit it.

Run: `npm run check`
Expected: no lint/format errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/wods/WodCard.tsx src/components/wods/CreateWodForm.tsx src/routes/wods/index.tsx src/routeTree.gen.ts
git commit -m "feat: add WOD library page with create form"
```

---

### Task 9: WOD detail route + log form + history

**Files:**
- Create: `src/components/wods/LogWodResultForm.tsx`
- Create: `src/components/wods/WodResultHistory.tsx`
- Create: `src/routes/wods/$id.tsx`

- [ ] **Step 1: Create `LogWodResultForm.tsx`**

Create `src/components/wods/LogWodResultForm.tsx`:

```tsx
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Stepper } from "#/components/ui/Stepper";

interface Props {
	wodId: Id<"wods">;
	type: Doc<"wods">["type"];
	sessionId?: Id<"workoutSessions">;
	onLogged?: () => void;
}

export function LogWodResultForm({ wodId, type, sessionId, onLogged }: Props) {
	const log = useMutation(api.wodResults.log);

	const [rxScaled, setRxScaled] = useState<"rx" | "scaled">("rx");
	const [minutes, setMinutes] = useState(5);
	const [seconds, setSeconds] = useState(0);
	const [timeCapped, setTimeCapped] = useState(false);
	const [rounds, setRounds] = useState(1);
	const [reps, setReps] = useState(0);
	const [load, setLoad] = useState(0);
	const [notes, setNotes] = useState("");
	const [saving, setSaving] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			const base = {
				wodId,
				sessionId,
				rxScaled,
				notes: notes.trim() || undefined,
			};
			if (type === "forTime") {
				await log({
					...base,
					timeCapped: timeCapped || undefined,
					timeSeconds: timeCapped ? undefined : minutes * 60 + seconds,
					reps: timeCapped ? reps : undefined,
				});
			} else if (type === "amrap") {
				await log({ ...base, rounds, reps });
			} else if (type === "emom") {
				await log({ ...base, reps });
			} else {
				await log({ ...base, load, loadUnit: "kg" });
			}
			setNotes("");
			onLogged?.();
		} finally {
			setSaving(false);
		}
	}

	return (
		<form
			onSubmit={(e) => void handleSubmit(e)}
			className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 flex flex-col gap-3"
		>
			<h2 className="text-sm font-semibold text-white">Log Result</h2>

			{type === "forTime" && (
				<>
					<label className="flex items-center gap-2 text-sm text-white">
						<input
							type="checkbox"
							checked={timeCapped}
							onChange={(e) => setTimeCapped(e.target.checked)}
						/>
						Hit the time cap (didn't finish)
					</label>
					{timeCapped ? (
						<Stepper
							value={reps}
							onChange={setReps}
							min={0}
							step={1}
							label="Reps"
						/>
					) : (
						<div className="flex gap-2">
							<Stepper
								value={minutes}
								onChange={setMinutes}
								min={0}
								step={1}
								unit="min"
								label="Min"
							/>
							<Stepper
								value={seconds}
								onChange={setSeconds}
								min={0}
								max={59}
								step={1}
								unit="sec"
								label="Sec"
							/>
						</div>
					)}
				</>
			)}

			{type === "amrap" && (
				<>
					<Stepper
						value={rounds}
						onChange={setRounds}
						min={0}
						step={1}
						label="Rounds"
					/>
					<Stepper
						value={reps}
						onChange={setReps}
						min={0}
						step={1}
						label="Reps"
					/>
				</>
			)}

			{type === "emom" && (
				<Stepper
					value={reps}
					onChange={setReps}
					min={0}
					step={1}
					label="Reps"
				/>
			)}

			{type === "load" && (
				<Stepper
					value={load}
					onChange={setLoad}
					min={0}
					step={2.5}
					unit="kg"
					label="Load"
				/>
			)}

			<div className="flex gap-2">
				{(["rx", "scaled"] as const).map((v) => (
					<button
						key={v}
						type="button"
						onClick={() => setRxScaled(v)}
						className={[
							"flex-1 h-9 rounded-lg text-xs font-medium uppercase transition-all",
							rxScaled === v
								? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/50"
								: "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white",
						].join(" ")}
					>
						{v}
					</button>
				))}
			</div>

			<textarea
				placeholder="Notes (optional)"
				value={notes}
				onChange={(e) => setNotes(e.target.value)}
				rows={2}
				className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
			/>

			<button
				type="submit"
				disabled={saving}
				className="w-full h-11 rounded-full bg-[var(--accent)] text-black text-sm font-bold disabled:opacity-40 hover:bg-[var(--accent-hover)] transition-colors"
			>
				Log Result
			</button>
		</form>
	);
}
```

- [ ] **Step 2: Create `WodResultHistory.tsx`**

Create `src/components/wods/WodResultHistory.tsx`:

```tsx
import type { Doc } from "@convex/_generated/dataModel";
import { format } from "date-fns";
import { Trophy } from "lucide-react";
import {
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { bestScore, formatScore, scoreRank } from "#/lib/wodScore";

interface Props {
	type: Doc<"wods">["type"];
	results: Doc<"wodResults">[];
}

export function WodResultHistory({ type, results }: Props) {
	if (results.length === 0) {
		return (
			<p className="text-sm text-[var(--text-muted)]">
				No results yet. Log your first result above.
			</p>
		);
	}

	const best = bestScore(type, results);
	const chartData = results.map((r) => ({
		date: format(new Date(r.date), "MMM d"),
		rank: scoreRank(type, r),
	}));

	return (
		<div className="flex flex-col gap-4">
			<div className="h-48 w-full">
				<ResponsiveContainer width="100%" height="100%">
					<LineChart data={chartData}>
						<XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
						<YAxis stroke="var(--text-muted)" fontSize={11} width={36} />
						<Tooltip
							contentStyle={{
								background: "var(--surface)",
								border: "1px solid var(--border)",
								borderRadius: 8,
								fontSize: 12,
							}}
						/>
						<Line
							type="monotone"
							dataKey="rank"
							stroke="var(--accent)"
							strokeWidth={2}
							dot={{ r: 3 }}
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>

			<div className="flex flex-col gap-2">
				{[...results]
					.sort((a, b) => b.date - a.date)
					.map((r) => (
						<div
							key={r._id}
							className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-4 py-2.5"
						>
							<div className="flex items-center gap-2">
								<span className="text-sm font-semibold text-white tabular-nums">
									{formatScore(type, r)}
								</span>
								<span className="text-[10px] uppercase text-[var(--text-muted)]">
									{r.rxScaled}
								</span>
								{best && r._id === best._id && (
									<Trophy size={13} className="text-[var(--accent)]" />
								)}
							</div>
							<span className="text-xs text-[var(--text-muted)]">
								{format(new Date(r.date), "MMM d, yyyy")}
							</span>
						</div>
					))}
			</div>
		</div>
	);
}
```

- [ ] **Step 3: Create the detail route**

Create `src/routes/wods/$id.tsx`:

```tsx
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { LogWodResultForm } from "#/components/wods/LogWodResultForm";
import { WodResultHistory } from "#/components/wods/WodResultHistory";

export const Route = createFileRoute("/wods/$id")({
	component: WodDetailGuarded,
});

function WodDetailGuarded() {
	return (
		<>
			<SignedIn>
				<WodDetailPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function WodDetailPage() {
	const { id } = Route.useParams();
	const wodId = id as Id<"wods">;
	const wod = useQuery(api.wods.getById, { id: wodId });
	const results = useQuery(api.wodResults.listForWod, { wodId }) ?? [];

	if (wod === undefined) {
		return (
			<div className="p-6 text-[var(--text-muted)] text-sm">Loading…</div>
		);
	}
	if (wod === null) {
		return <div className="p-6 text-red-400 text-sm">WOD not found.</div>;
	}

	return (
		<div className="p-4 sm:p-6 max-w-3xl mx-auto flex flex-col gap-6">
			<div>
				<Link
					to="/wods"
					className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-white transition-colors mb-3"
				>
					<ArrowLeft size={13} />
					WODs
				</Link>
				<h1 className="text-2xl font-bold text-white">{wod.name}</h1>
				{wod.repScheme && (
					<p className="text-sm text-[var(--accent)] mt-1">{wod.repScheme}</p>
				)}
				{wod.description && (
					<p className="text-sm text-[var(--text-muted)] mt-2">
						{wod.description}
					</p>
				)}
				<ul className="mt-3 flex flex-col gap-1">
					{wod.movements.map((m, i) => (
						<li key={`${m.name}-${i}`} className="text-sm text-white">
							{m.reps ? `${m.reps} ` : ""}
							{m.name}
							{m.weight ? ` @ ${m.weight}${m.unit ?? "kg"}` : ""}
							{m.distance ? ` ${m.distance}${m.distanceUnit ?? ""}` : ""}
						</li>
					))}
				</ul>
			</div>

			<LogWodResultForm wodId={wodId} type={wod.type} />

			<div>
				<h2 className="text-sm font-semibold text-white mb-3">History</h2>
				<WodResultHistory type={wod.type} results={results} />
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Verify in the browser**

With `npm run dev:all` running, open a WOD from `/wods`. Log a couple of results of each type and confirm: score formats correctly (e.g. `3:21`, `6 + 14`), the trophy marks the best, and the trend chart renders. For a For-Time WOD, log a finish and a capped result and confirm the finish is marked best.

Run: `npm run check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/wods/LogWodResultForm.tsx src/components/wods/WodResultHistory.tsx src/routes/wods/$id.tsx src/routeTree.gen.ts
git commit -m "feat: add WOD detail page with result logging and history"
```

---

### Task 10: Attach WODs to a workout session

Adds an "Add WOD" affordance to the active session page and shows attached WOD results on both the active session and the completed-session summary.

**Files:**
- Create: `src/components/session/SessionWods.tsx`
- Modify: `src/routes/log/$sessionId.tsx` (render `SessionWods` on the active session)
- Modify: `src/components/session/SessionSummary.tsx` (show attached WODs on completed sessions)

- [ ] **Step 1: Create `SessionWods.tsx`**

Create `src/components/session/SessionWods.tsx`:

```tsx
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { LogWodResultForm } from "#/components/wods/LogWodResultForm";
import { formatScore } from "#/lib/wodScore";

export function SessionWods({
	sessionId,
}: {
	sessionId: Id<"workoutSessions">;
}) {
	const wods = useQuery(api.wods.list) ?? [];
	const results = useQuery(api.wodResults.listForSession, { sessionId }) ?? [];
	const [picking, setPicking] = useState(false);
	const [selectedId, setSelectedId] = useState<Id<"wods"> | null>(null);

	const wodMap = new Map(wods.map((w) => [w._id as string, w]));
	const selected = selectedId ? wodMap.get(selectedId as string) : null;

	return (
		<div className="mt-4 flex flex-col gap-3">
			{results.map((r) => {
				const wod = wodMap.get(r.wodId as string);
				if (!wod) return null;
				return (
					<div
						key={r._id}
						className="flex items-center justify-between rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3"
					>
						<span className="text-sm font-semibold text-white">
							{wod.name}
						</span>
						<span className="text-sm text-[var(--accent)] tabular-nums">
							{formatScore(wod.type, r)}
						</span>
					</div>
				);
			})}

			{selected ? (
				<div className="relative">
					<button
						type="button"
						onClick={() => setSelectedId(null)}
						className="absolute right-3 top-3 z-10 p-1 text-[var(--text-muted)] hover:text-white"
						aria-label="Close WOD form"
					>
						<X size={16} />
					</button>
					<LogWodResultForm
						wodId={selected._id}
						type={selected.type}
						sessionId={sessionId}
						onLogged={() => setSelectedId(null)}
					/>
				</div>
			) : picking ? (
				<div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] max-h-64 overflow-y-auto">
					{wods.map((w) => (
						<button
							key={w._id}
							type="button"
							onClick={() => {
								setSelectedId(w._id);
								setPicking(false);
							}}
							className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
						>
							{w.name}
						</button>
					))}
				</div>
			) : (
				<button
					type="button"
					onClick={() => setPicking(true)}
					className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] text-sm hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors"
				>
					<Plus size={16} />
					Add WOD
				</button>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Render `SessionWods` on the active session**

In `src/routes/log/$sessionId.tsx`, add the import near the other session-component imports (after the `SetEditSheet` import line):

```tsx
import { SessionWods } from "#/components/session/SessionWods";
```

Then, in the active-session `return (...)`, add `<SessionWods .../>` immediately after the closing `)}` of the `{showAddExercise && ( <AddExerciseModal ... /> )}` block and before the `<SetEditSheet ... />` element:

```tsx
				<SessionWods sessionId={sessionId as Id<"workoutSessions">} />
```

- [ ] **Step 3: Show attached WODs on the completed-session summary**

First read `src/components/session/SessionSummary.tsx` to see how it receives `session` and renders the body. Add this import at the top:

```tsx
import { formatScore } from "#/lib/wodScore";
```

Add this query inside the component body (alongside its other hooks; it already has access to `session._id`):

```tsx
	const wodResults =
		useQuery(api.wodResults.listForSession, { sessionId: session._id }) ?? [];
	const wods = useQuery(api.wods.list) ?? [];
	const wodMap = new Map(wods.map((w) => [w._id as string, w]));
```

(If `useQuery` / `api` are not already imported in that file, add `import { useQuery } from "convex/react";` and `import { api } from "@convex/_generated/api";`.)

Then render this block where the summary lists its content (e.g. after the sets/exercise summary, before the container's closing tag):

```tsx
			{wodResults.length > 0 && (
				<div className="mt-4 flex flex-col gap-2">
					<h3 className="text-sm font-semibold text-white">WODs</h3>
					{wodResults.map((r) => {
						const wod = wodMap.get(r.wodId as string);
						if (!wod) return null;
						return (
							<div
								key={r._id}
								className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-4 py-2.5"
							>
								<span className="text-sm text-white">{wod.name}</span>
								<span className="text-sm text-[var(--accent)] tabular-nums">
									{formatScore(wod.type, r)}{" "}
									<span className="text-[10px] uppercase text-[var(--text-muted)]">
										{r.rxScaled}
									</span>
								</span>
							</div>
						);
					})}
				</div>
			)}
```

- [ ] **Step 4: Verify in the browser**

With `npm run dev:all` running: start a workout session (`/log` → start), log a strength exercise, then use "Add WOD" to pick a benchmark and log a result. Confirm the result appears in the session. Finish the workout and confirm the WOD block shows on the summary.

Run: `npm run check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/session/SessionWods.tsx src/routes/log/$sessionId.tsx src/components/session/SessionSummary.tsx
git commit -m "feat: attach WOD results to workout sessions"
```

---

### Task 11: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including `src/lib/wodScore.test.ts` and `src/components/navItems.test.ts`.

- [ ] **Step 2: Lint + format check**

Run: `npm run check`
Expected: no lint or format errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Manual smoke test**

With `npm run dev:all` running, confirm end-to-end:
- `/wods` lists benchmarks + your created WODs.
- Creating a WOD of each type works; the time-cap/duration field shows only for the relevant types.
- Logging results of each type formats and ranks correctly; PR trophy and trend chart behave.
- A For-Time finish always ranks above a capped attempt.
- "Add WOD" inside a session attaches a result; it shows on the completed summary.

- [ ] **Step 5: Final commit (if any formatting changed)**

```bash
git add -A
git commit -m "chore: verification pass for CrossFit WOD logging" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**
- Two tables separate from sets/exercises → Task 1. ✓
- Structured free-text movements → Task 1 (`movements` array). ✓
- For Time / AMRAP / EMOM / Load scoring → Tasks 2/3 (`scoreRank`/`formatScore`), Task 9 (`LogWodResultForm` per-type inputs). ✓
- Comparison over time + PR → Tasks 2/3 (`bestScore`), Task 5 (`getBest`), Task 9 (`WodResultHistory` trophy + chart). ✓
- WOD library w/ seeded benchmarks → Task 4 (`list`), Task 6 (seed). ✓
- Quick-create on the fly → Task 4 `create` doubles as quick-create (empty movements allowed), used by Task 10 picker. ✓
- Flexible session link (standalone or attached) → Task 1 optional `sessionId`, Task 9 standalone log, Task 10 session-attached log. ✓
- Cascade delete WOD → results → Task 4 `remove`; clear on reset → Task 6 `deleteUserData`. ✓
- Time-cap edge case, kg/lbs Load normalization → Tasks 2/3 + tests. ✓
- Navigation entry → Task 7. ✓
- Session summary block → Task 10 Step 3. ✓
- Vitest unit tests for scoring → Task 2. ✓

**Deviations from spec (intentional, noted):**
- No separate `quickCreate` mutation — `wods.create` accepts optional fields and an empty movements array, serving the quick-create flow (DRY). The session picker (Task 10) selects existing WODs; ad-hoc creation is done via `/wods`.
- `listRecent` (dashboard feed) omitted — no dashboard surface is in scope for v1 (YAGNI). `listForWod` and `listForSession` cover the implemented views.
- WOD editing UI not built (only the `update` backend exists) — out of scope for v1; deletion + recreate covers correction needs.

**Type consistency:** `WodScoreInput` fields, `WodType` literals, and the `scoreFields`/`wodFields` validators match across client (`src/lib/wodScore.ts`), server (`convex/lib/wodScore.ts`, `convex/wods.ts`, `convex/wodResults.ts`), and component props (`type: Doc<"wods">["type"]`). `bestScore` returns the original `Doc<"wodResults">` element so `r._id === best._id` is valid in `WodResultHistory`.

**Placeholder scan:** No TBD/TODO; every code step contains complete code.
