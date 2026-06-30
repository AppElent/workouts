# Hosted Workouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build hosted workouts with QR join links, signed-in participant personal logs, guest leaderboard submissions, host open/close controls, and Rx/L1/L2/L3 WOD prescriptions.

**Architecture:** Add a host-owned event layer on top of the existing personal workout model. Hosted workouts store the immutable workout prescription and public join token; signed-in participants still create normal `workoutSessions`, `sets`, and `wodResults`; hosted submissions power the shared leaderboard. The UI adds host management routes plus a public join route that branches into signed-in participation or guest submission.

**Tech Stack:** React 19, TanStack Router, Clerk, Convex, Vitest, Biome, Tailwind CSS, `qrcode.react`.

---

## File Structure

- Create `src/lib/hostedWorkouts.ts` for pure hosted workout helpers: level labels, score validation, leaderboard sorting, and template utilities.
- Create `src/lib/hostedWorkouts.test.ts` for helper tests.
- Modify `convex/schema.ts` to add `hostedWorkouts`, `hostedWorkoutParticipants`, and `hostedWorkoutSubmissions`.
- Create `convex/hostedWorkouts.ts` for host CRUD, status transitions, and public token lookup.
- Create `convex/hostedWorkoutParticipants.ts` for signed-in join, idempotent participant lookup, and hosted context by personal session.
- Create `convex/hostedWorkoutSubmissions.ts` for signed-in and guest submissions plus leaderboard queries.
- Create `src/components/hosted/HostedWorkoutBuilder.tsx` for draft creation and editing.
- Create `src/components/hosted/HostedWorkoutDashboard.tsx` for host status controls, QR/link, participants, and leaderboard.
- Create `src/components/hosted/HostedLeaderboard.tsx` for shared score display.
- Create `src/components/hosted/HostedWorkoutQr.tsx` for QR rendering and copyable link.
- Create `src/components/hosted/JoinHostedWorkout.tsx` for public join flow.
- Create `src/components/hosted/GuestSubmissionForm.tsx` for guest leaderboard-only submissions.
- Create `src/components/session/HostedSessionPlan.tsx` for rendering hosted strength prescriptions inside a participant's personal session without writing fake sets.
- Create `src/routes/hosted-workouts/index.tsx`, `src/routes/hosted-workouts/new.tsx`, `src/routes/hosted-workouts/$id.tsx`, and `src/routes/join/$token.tsx`.
- Modify `src/routes/log/$sessionId.tsx` to show hosted planned work when a session is linked to a hosted workout.
- Modify `src/components/navItems.ts`, `src/components/Sidebar.tsx`, and `src/components/BottomTabBar.tsx` only if `navItems.ts` is not the single source of navigation truth.
- Modify `package.json` and `pnpm-lock.yaml` to add `qrcode.react`.

---

### Task 1: Hosted Workout Pure Helpers

**Files:**
- Create: `src/lib/hostedWorkouts.ts`
- Create: `src/lib/hostedWorkouts.test.ts`

- [ ] **Step 1: Write failing tests for levels, score validation, and leaderboard sorting**

Create `src/lib/hostedWorkouts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	formatHostedScore,
	getHostedLevelLabel,
	sortHostedLeaderboard,
	validateHostedScore,
} from "./hostedWorkouts";

describe("getHostedLevelLabel", () => {
	it("formats canonical hosted workout levels", () => {
		expect(getHostedLevelLabel("rx")).toBe("Rx");
		expect(getHostedLevelLabel("l1")).toBe("L1");
		expect(getHostedLevelLabel("l2")).toBe("L2");
		expect(getHostedLevelLabel("l3")).toBe("L3");
	});
});

describe("validateHostedScore", () => {
	it("accepts a for-time finish", () => {
		expect(
			validateHostedScore("forTime", {
				timeSeconds: 421,
				timeCapped: false,
			}),
		).toEqual({ ok: true });
	});

	it("rejects a for-time score without time", () => {
		expect(validateHostedScore("forTime", {})).toEqual({
			ok: false,
			message: "Time is required for this WOD.",
		});
	});

	it("accepts an AMRAP rounds plus reps score", () => {
		expect(validateHostedScore("amrap", { rounds: 7, reps: 12 })).toEqual({
			ok: true,
		});
	});

	it("rejects a load score without load unit", () => {
		expect(validateHostedScore("load", { load: 120 })).toEqual({
			ok: false,
			message: "Load unit is required for this WOD.",
		});
	});
});

describe("formatHostedScore", () => {
	it("formats for-time capped and finished scores", () => {
		expect(formatHostedScore("forTime", { timeSeconds: 421 })).toBe("7:01");
		expect(
			formatHostedScore("forTime", {
				timeSeconds: 600,
				timeCapped: true,
				reps: 18,
			}),
		).toBe("CAP + 18");
	});

	it("formats AMRAP and load scores", () => {
		expect(formatHostedScore("amrap", { rounds: 5, reps: 9 })).toBe("5 + 9");
		expect(formatHostedScore("load", { load: 225, loadUnit: "lbs" })).toBe(
			"225 lbs",
		);
	});
});

describe("sortHostedLeaderboard", () => {
	it("sorts one combined leaderboard while keeping level badges available", () => {
		const rows = sortHostedLeaderboard("forTime", [
			{
				id: "capped",
				name: "Capped Athlete",
				level: "l2",
				submittedAt: 3,
				score: { timeSeconds: 600, timeCapped: true, reps: 90 },
			},
			{
				id: "fast",
				name: "Fast Athlete",
				level: "rx",
				submittedAt: 2,
				score: { timeSeconds: 320 },
			},
			{
				id: "faster",
				name: "Faster Athlete",
				level: "l1",
				submittedAt: 1,
				score: { timeSeconds: 300 },
			},
		]);

		expect(rows.map((row) => row.id)).toEqual(["faster", "fast", "capped"]);
		expect(rows[0]?.level).toBe("l1");
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/hostedWorkouts.test.ts`

Expected: FAIL with an import error for `./hostedWorkouts`.

- [ ] **Step 3: Implement the helper module**

Create `src/lib/hostedWorkouts.ts`:

```ts
export type HostedLevel = "rx" | "l1" | "l2" | "l3";
export type HostedWodType = "forTime" | "amrap" | "emom" | "load";
export type LoadUnit = "kg" | "lbs";

export type HostedScore = {
	timeSeconds?: number;
	rounds?: number;
	reps?: number;
	timeCapped?: boolean;
	load?: number;
	loadUnit?: LoadUnit;
};

export type HostedLeaderboardRow = {
	id: string;
	name: string;
	level: HostedLevel;
	submittedAt: number;
	score: HostedScore;
};

export type ValidationResult =
	| { ok: true }
	| { ok: false; message: string };

const KG_PER_LB = 0.45359237;
const AMRAP_ROUND_SIZE = 100_000;

export function getHostedLevelLabel(level: HostedLevel) {
	const labels: Record<HostedLevel, string> = {
		rx: "Rx",
		l1: "L1",
		l2: "L2",
		l3: "L3",
	};
	return labels[level];
}

export function validateHostedScore(
	type: HostedWodType,
	score: HostedScore,
): ValidationResult {
	if (type === "forTime") {
		if (score.timeSeconds === undefined) {
			return { ok: false, message: "Time is required for this WOD." };
		}
		return { ok: true };
	}
	if (type === "amrap") {
		if (score.rounds === undefined && score.reps === undefined) {
			return { ok: false, message: "Rounds or reps are required for this WOD." };
		}
		return { ok: true };
	}
	if (type === "emom") {
		if (score.reps === undefined && score.rounds === undefined) {
			return { ok: false, message: "Completed reps or rounds are required for this WOD." };
		}
		return { ok: true };
	}
	if (score.load === undefined) {
		return { ok: false, message: "Load is required for this WOD." };
	}
	if (score.loadUnit === undefined) {
		return { ok: false, message: "Load unit is required for this WOD." };
	}
	return { ok: true };
}

export function formatHostedScore(type: HostedWodType, score: HostedScore) {
	if (type === "forTime") {
		if (score.timeCapped) return `CAP + ${score.reps ?? 0}`;
		return formatSeconds(score.timeSeconds ?? 0);
	}
	if (type === "amrap") return `${score.rounds ?? 0} + ${score.reps ?? 0}`;
	if (type === "emom") return `${score.reps ?? score.rounds ?? 0} reps`;
	return `${score.load ?? 0} ${score.loadUnit ?? "kg"}`;
}

export function sortHostedLeaderboard(
	type: HostedWodType,
	rows: HostedLeaderboardRow[],
) {
	return [...rows].sort((a, b) => {
		const rankDiff = scoreRank(type, b.score) - scoreRank(type, a.score);
		if (rankDiff !== 0) return rankDiff;
		return a.submittedAt - b.submittedAt;
	});
}

export function scoreRank(type: HostedWodType, score: HostedScore) {
	if (type === "forTime") {
		if (score.timeCapped) return -1_000_000 + (score.reps ?? 0);
		return 1_000_000 - (score.timeSeconds ?? 86_400);
	}
	if (type === "amrap") {
		return (score.rounds ?? 0) * AMRAP_ROUND_SIZE + (score.reps ?? 0);
	}
	if (type === "emom") return score.reps ?? score.rounds ?? 0;
	const load = score.load ?? 0;
	return score.loadUnit === "lbs" ? load * KG_PER_LB : load;
}

function formatSeconds(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.floor(totalSeconds % 60);
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run helper tests**

Run: `npx vitest run src/lib/hostedWorkouts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit helper work**

```bash
git add src/lib/hostedWorkouts.ts src/lib/hostedWorkouts.test.ts
git commit -m "feat: add hosted workout helpers"
```

---

### Task 2: Convex Schema

**Files:**
- Modify: `convex/schema.ts`
- Generated after Convex run: `convex/_generated/api.d.ts`, `convex/_generated/api.js`, `convex/_generated/dataModel.d.ts`, `convex/_generated/server.d.ts`, `convex/_generated/server.js`

- [ ] **Step 1: Add schema tables**

Modify `convex/schema.ts` by adding these table definitions inside `defineSchema({ ... })` after `wodResults`:

```ts
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
    rxScaled: v.optional(v.union(v.literal('rx'), v.literal('scaled'))),
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
```

- [ ] **Step 2: Regenerate Convex types**

Run: `npx convex dev --once`

Expected: Convex codegen succeeds and generated files update.

- [ ] **Step 3: Run type/build check**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit schema work**

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat: add hosted workout schema"
```

---

### Task 3: Host-Owned Workout API

**Files:**
- Create: `convex/hostedWorkouts.ts`

- [ ] **Step 1: Create validator helpers and host mutations**

Create `convex/hostedWorkouts.ts`:

```ts
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

const level = v.union(
  v.literal('rx'),
  v.literal('l1'),
  v.literal('l2'),
  v.literal('l3'),
)

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

const template = v.object({
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
          level,
          label: v.string(),
          description: v.optional(v.string()),
          movements: v.array(movement),
        }),
      ),
    }),
  ),
})

function createJoinToken() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let token = ''
  for (let i = 0; i < 18; i++) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return token
}

function assertTemplateIsUsable(input: {
  strengthBlocks: { exerciseName: string }[]
  wodBlocks: { name: string; levels: { level: string }[] }[]
}) {
  if (input.strengthBlocks.length === 0 && input.wodBlocks.length === 0) {
    throw new Error('Add at least one strength block or WOD.')
  }
  for (const block of input.strengthBlocks) {
    if (!block.exerciseName.trim()) throw new Error('Exercise name is required.')
  }
  for (const block of input.wodBlocks) {
    if (!block.name.trim()) throw new Error('WOD name is required.')
    const levels = new Set(block.levels.map((l) => l.level))
    for (const required of ['rx', 'l1', 'l2', 'l3']) {
      if (!levels.has(required)) throw new Error('Each WOD needs Rx, L1, L2, and L3.')
    }
  }
}

export const createDraft = mutation({
  args: {
    title: v.string(),
    notes: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    hostParticipation: v.union(
      v.literal('hostOnly'),
      v.literal('hostAndParticipate'),
    ),
    template,
  },
  handler: async (ctx, args) => {
    const hostUserId = await requireUser(ctx)
    if (!args.title.trim()) throw new Error('Title is required.')
    assertTemplateIsUsable(args.template)
    const now = Date.now()
    return ctx.db.insert('hostedWorkouts', {
      hostUserId,
      title: args.title.trim(),
      notes: args.notes?.trim() || undefined,
      scheduledAt: args.scheduledAt,
      status: 'draft',
      joinToken: createJoinToken(),
      hostParticipation: args.hostParticipation,
      createdAt: now,
      template: args.template,
    })
  },
})

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const hostUserId = await requireUser(ctx)
    return ctx.db
      .query('hostedWorkouts')
      .withIndex('by_host', (q) => q.eq('hostUserId', hostUserId))
      .order('desc')
      .collect()
  },
})

export const getMine = query({
  args: { id: v.id('hostedWorkouts') },
  handler: async (ctx, { id }) => {
    const hostUserId = await requireUser(ctx)
    const hosted = await ctx.db.get(id)
    if (!hosted || hosted.hostUserId !== hostUserId) return null
    const participants = await ctx.db
      .query('hostedWorkoutParticipants')
      .withIndex('by_hosted_workout', (q) => q.eq('hostedWorkoutId', id))
      .collect()
    const submissions = await ctx.db
      .query('hostedWorkoutSubmissions')
      .withIndex('by_hosted_workout', (q) => q.eq('hostedWorkoutId', id))
      .collect()
    return { hosted, participants, submissions }
  },
})

export const getByJoinToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const hosted = await ctx.db
      .query('hostedWorkouts')
      .withIndex('by_join_token', (q) => q.eq('joinToken', token))
      .first()
    if (!hosted) return null
    const submissions = await ctx.db
      .query('hostedWorkoutSubmissions')
      .withIndex('by_hosted_workout', (q) => q.eq('hostedWorkoutId', hosted._id))
      .collect()
    return { hosted, submissions }
  },
})

export const updateDraft = mutation({
  args: {
    id: v.id('hostedWorkouts'),
    title: v.string(),
    notes: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    hostParticipation: v.union(
      v.literal('hostOnly'),
      v.literal('hostAndParticipate'),
    ),
    template,
  },
  handler: async (ctx, { id, ...patch }) => {
    const hostUserId = await requireUser(ctx)
    const hosted = await ctx.db.get(id)
    if (!hosted || hosted.hostUserId !== hostUserId) throw new Error('Unauthorized')
    if (hosted.status !== 'draft') throw new Error('Only draft workouts can be edited.')
    if (!patch.title.trim()) throw new Error('Title is required.')
    assertTemplateIsUsable(patch.template)
    await ctx.db.patch(id, {
      ...patch,
      title: patch.title.trim(),
      notes: patch.notes?.trim() || undefined,
    })
  },
})

export const open = mutation({
  args: { id: v.id('hostedWorkouts') },
  handler: async (ctx, { id }) => {
    const hostUserId = await requireUser(ctx)
    const hosted = await ctx.db.get(id)
    if (!hosted || hosted.hostUserId !== hostUserId) throw new Error('Unauthorized')
    if (hosted.status !== 'draft') throw new Error('Only draft workouts can be opened.')
    await ctx.db.patch(id, { status: 'open', openedAt: Date.now() })
  },
})

export const close = mutation({
  args: { id: v.id('hostedWorkouts') },
  handler: async (ctx, { id }) => {
    const hostUserId = await requireUser(ctx)
    const hosted = await ctx.db.get(id)
    if (!hosted || hosted.hostUserId !== hostUserId) throw new Error('Unauthorized')
    if (hosted.status !== 'open') throw new Error('Only open workouts can be closed.')
    await ctx.db.patch(id, { status: 'closed', closedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id('hostedWorkouts') },
  handler: async (ctx, { id }) => {
    const hostUserId = await requireUser(ctx)
    const hosted = await ctx.db.get(id)
    if (!hosted || hosted.hostUserId !== hostUserId) throw new Error('Unauthorized')
    const submissions = await ctx.db
      .query('hostedWorkoutSubmissions')
      .withIndex('by_hosted_workout', (q) => q.eq('hostedWorkoutId', id))
      .collect()
    for (const submission of submissions) await ctx.db.delete(submission._id)
    const participants = await ctx.db
      .query('hostedWorkoutParticipants')
      .withIndex('by_hosted_workout', (q) => q.eq('hostedWorkoutId', id))
      .collect()
    for (const participant of participants) await ctx.db.delete(participant._id)
    await ctx.db.delete(id)
  },
})
```

- [ ] **Step 2: Regenerate Convex types**

Run: `npx convex dev --once`

Expected: generated API includes `hostedWorkouts`.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit host API**

```bash
git add convex/hostedWorkouts.ts convex/_generated
git commit -m "feat: add hosted workout host api"
```

---

### Task 4: Participant Join API

**Files:**
- Create: `convex/hostedWorkoutParticipants.ts`

- [ ] **Step 1: Implement signed-in join and hosted session context**

Create `convex/hostedWorkoutParticipants.ts`:

```ts
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'

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
    return { participant, hosted }
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
```

- [ ] **Step 2: Regenerate Convex types**

Run: `npx convex dev --once`

Expected: generated API includes `hostedWorkoutParticipants`.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit participant API**

```bash
git add convex/hostedWorkoutParticipants.ts convex/_generated
git commit -m "feat: add hosted workout participant join api"
```

---

### Task 5: Hosted Submission API

**Files:**
- Create: `convex/hostedWorkoutSubmissions.ts`

- [ ] **Step 1: Implement signed-in and guest submissions**

Create `convex/hostedWorkoutSubmissions.ts`:

```ts
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { assertOptionalRange } from './lib/validate'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthenticated')
  return identity.subject
}

const scoreFields = {
  level: v.union(v.literal('rx'), v.literal('l1'), v.literal('l2'), v.literal('l3')),
  rxScaled: v.optional(v.union(v.literal('rx'), v.literal('scaled'))),
  timeSeconds: v.optional(v.number()),
  rounds: v.optional(v.number()),
  reps: v.optional(v.number()),
  timeCapped: v.optional(v.boolean()),
  load: v.optional(v.number()),
  loadUnit: v.optional(v.union(v.literal('kg'), v.literal('lbs'))),
  notes: v.optional(v.string()),
}

function assertScoreRanges(score: {
  timeSeconds?: number
  rounds?: number
  reps?: number
  load?: number
}) {
  assertOptionalRange(score.timeSeconds, 0, 86400, 'Time')
  assertOptionalRange(score.rounds, 0, 10000, 'Rounds')
  assertOptionalRange(score.reps, 0, 100000, 'Reps')
  assertOptionalRange(score.load, 0, 2000, 'Load')
}

function findWodBlock(
  hosted: NonNullable<Awaited<ReturnType<QueryCtx['db']['get']>>>,
  wodBlockId: string,
) {
  if (!('template' in hosted)) return null
  return hosted.template.wodBlocks.find((block) => block.blockId === wodBlockId) ?? null
}

export const submitForParticipant = mutation({
  args: {
    participantId: v.id('hostedWorkoutParticipants'),
    wodBlockId: v.string(),
    ...scoreFields,
  },
  handler: async (ctx, { participantId, wodBlockId, ...score }) => {
    const userId = await requireUser(ctx)
    assertScoreRanges(score)
    const participant = await ctx.db.get(participantId)
    if (!participant || participant.userId !== userId) throw new Error('Unauthorized')
    const hosted = await ctx.db.get(participant.hostedWorkoutId)
    if (!hosted) throw new Error('Hosted workout not found.')
    if (hosted.status !== 'open') throw new Error('This hosted workout is closed.')
    const wodBlock = findWodBlock(hosted, wodBlockId)
    if (!wodBlock) throw new Error('WOD block not found.')
    if (!wodBlock.levels.some((l) => l.level === score.level)) {
      throw new Error('Level not found for this WOD.')
    }
    const now = Date.now()

    let wodId = wodBlock.wodId
    if (!wodId) {
      wodId = await ctx.db.insert('wods', {
        userId,
        name: wodBlock.name,
        type: wodBlock.type,
        description: wodBlock.description,
        repScheme: wodBlock.repScheme,
        timeCapSeconds: wodBlock.timeCapSeconds,
        durationSeconds: wodBlock.durationSeconds,
        movements: wodBlock.levels.find((l) => l.level === score.level)?.movements ?? [],
        isDefault: false,
      })
    }

    await ctx.db.insert('wodResults', {
      userId,
      wodId,
      sessionId: participant.sessionId,
      date: now,
      rxScaled: score.rxScaled ?? (score.level === 'rx' ? 'rx' : 'scaled'),
      timeSeconds: score.timeSeconds,
      rounds: score.rounds,
      reps: score.reps,
      timeCapped: score.timeCapped,
      load: score.load,
      loadUnit: score.loadUnit,
      notes: score.notes,
    })

    return ctx.db.insert('hostedWorkoutSubmissions', {
      hostedWorkoutId: participant.hostedWorkoutId,
      participantId,
      wodBlockId,
      submittedAt: now,
      ...score,
    })
  },
})

export const submitGuest = mutation({
  args: {
    token: v.string(),
    guestName: v.string(),
    wodBlockId: v.string(),
    ...scoreFields,
  },
  handler: async (ctx, { token, guestName, wodBlockId, ...score }) => {
    assertScoreRanges(score)
    const cleanName = guestName.trim()
    if (cleanName.length < 2 || cleanName.length > 80) {
      throw new Error('Enter a display name between 2 and 80 characters.')
    }
    const hosted = await ctx.db
      .query('hostedWorkouts')
      .withIndex('by_join_token', (q) => q.eq('joinToken', token))
      .first()
    if (!hosted) throw new Error('Hosted workout not found.')
    if (hosted.status !== 'open') throw new Error('This hosted workout is closed.')
    const wodBlock = hosted.template.wodBlocks.find((block) => block.blockId === wodBlockId)
    if (!wodBlock) throw new Error('WOD block not found.')
    if (!wodBlock.levels.some((l) => l.level === score.level)) {
      throw new Error('Level not found for this WOD.')
    }
    return ctx.db.insert('hostedWorkoutSubmissions', {
      hostedWorkoutId: hosted._id,
      guestName: cleanName,
      wodBlockId,
      submittedAt: Date.now(),
      ...score,
    })
  },
})

export const listPublicLeaderboard = query({
  args: { hostedWorkoutId: v.id('hostedWorkouts') },
  handler: async (ctx, { hostedWorkoutId }) => {
    const hosted = await ctx.db.get(hostedWorkoutId)
    if (!hosted || hosted.status === 'draft') return []
    return ctx.db
      .query('hostedWorkoutSubmissions')
      .withIndex('by_hosted_workout', (q) => q.eq('hostedWorkoutId', hostedWorkoutId))
      .collect()
  },
})

export const remove = mutation({
  args: { id: v.id('hostedWorkoutSubmissions') },
  handler: async (ctx, { id }) => {
    const hostUserId = await requireUser(ctx)
    const submission = await ctx.db.get(id)
    if (!submission) throw new Error('Submission not found.')
    const hosted = await ctx.db.get(submission.hostedWorkoutId)
    if (!hosted || hosted.hostUserId !== hostUserId) throw new Error('Unauthorized')
    await ctx.db.delete(id)
  },
})
```

- [ ] **Step 2: Run Convex codegen**

Run: `npx convex dev --once`

Expected: generated API includes `hostedWorkoutSubmissions`.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS. If TypeScript rejects the `findWodBlock` helper type, inline the lookup in `submitForParticipant` and keep the same validation behavior.

- [ ] **Step 4: Commit submission API**

```bash
git add convex/hostedWorkoutSubmissions.ts convex/_generated
git commit -m "feat: add hosted workout submissions api"
```

---

### Task 6: QR Dependency and Navigation

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/components/navItems.ts`

- [ ] **Step 1: Add QR dependency**

Run: `pnpm add qrcode.react`

Expected: `package.json` gains `qrcode.react` in `dependencies`, and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Add hosted workouts navigation item**

Modify `src/components/navItems.ts` so the exported navigation list includes:

```ts
{
	to: "/hosted-workouts",
	label: "Host",
	icon: Radio,
}
```

Also add `Radio` to the existing `lucide-react` import in that file.

- [ ] **Step 3: Run navigation tests**

Run: `npx vitest run src/components/navItems.test.ts`

Expected: PASS. If the test expects an exact nav list, update the expected labels to include `"Host"`.

- [ ] **Step 4: Commit dependency and nav**

```bash
git add package.json pnpm-lock.yaml src/components/navItems.ts src/components/navItems.test.ts
git commit -m "feat: add hosted workouts navigation"
```

---

### Task 7: Host Builder and Routes

**Files:**
- Create: `src/components/hosted/HostedWorkoutBuilder.tsx`
- Create: `src/routes/hosted-workouts/index.tsx`
- Create: `src/routes/hosted-workouts/new.tsx`

- [ ] **Step 1: Create a v1 builder component**

Create `src/components/hosted/HostedWorkoutBuilder.tsx`:

```tsx
import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

type StrengthBlock = {
	blockId: string;
	exerciseName: string;
	instructions?: string;
	defaultSets?: number;
	defaultReps?: number;
	defaultWeight?: number;
	unit?: "kg" | "lbs";
	percentageOfOneRepMax?: number;
};

type Level = "rx" | "l1" | "l2" | "l3";

type Movement = {
	name: string;
	reps?: number;
	weight?: number;
	unit?: "kg" | "lbs";
	notes?: string;
};

type WodBlock = {
	blockId: string;
	name: string;
	type: "forTime" | "amrap" | "emom" | "load";
	description?: string;
	levels: {
		level: Level;
		label: string;
		description?: string;
		movements: Movement[];
	}[];
};

const defaultLevels: WodBlock["levels"] = [
	{ level: "rx", label: "Rx", movements: [{ name: "" }] },
	{ level: "l1", label: "L1", movements: [{ name: "" }] },
	{ level: "l2", label: "L2", movements: [{ name: "" }] },
	{ level: "l3", label: "L3", movements: [{ name: "" }] },
];

function newBlockId() {
	return crypto.randomUUID();
}

export function HostedWorkoutBuilder({
	onCreated,
}: {
	onCreated: (id: string) => void;
}) {
	const createDraft = useMutation(api.hostedWorkouts.createDraft);
	const [title, setTitle] = useState("");
	const [notes, setNotes] = useState("");
	const [hostParticipation, setHostParticipation] = useState<
		"hostOnly" | "hostAndParticipate"
	>("hostOnly");
	const [strengthBlocks, setStrengthBlocks] = useState<StrengthBlock[]>([]);
	const [wodBlocks, setWodBlocks] = useState<WodBlock[]>([]);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (saving) return;
		setSaving(true);
		setError("");
		try {
			const id = await createDraft({
				title,
				notes: notes.trim() || undefined,
				hostParticipation,
				template: {
					strengthBlocks: strengthBlocks.map((block) => ({
						...block,
						exerciseName: block.exerciseName.trim(),
						instructions: block.instructions?.trim() || undefined,
					})),
					wodBlocks: wodBlocks.map((block) => ({
						...block,
						name: block.name.trim(),
						description: block.description?.trim() || undefined,
						levels: block.levels.map((level) => ({
							...level,
							description: level.description?.trim() || undefined,
							movements: level.movements
								.map((movement) => ({
									...movement,
									name: movement.name.trim(),
									notes: movement.notes?.trim() || undefined,
								}))
								.filter((movement) => movement.name.length > 0),
						})),
					})),
				},
			});
			onCreated(id);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save workout");
		} finally {
			setSaving(false);
		}
	}

	return (
		<form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
			<div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
				<label className="text-xs font-semibold text-[var(--text-muted)]">
					Title
				</label>
				<input
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					className="mt-2 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white"
					placeholder="Saturday class"
				/>
				<textarea
					value={notes}
					onChange={(event) => setNotes(event.target.value)}
					className="mt-3 min-h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white"
					placeholder="Workout notes"
				/>
				<div className="mt-3 grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() => setHostParticipation("hostOnly")}
						className={`rounded-lg border px-3 py-2 text-sm ${hostParticipation === "hostOnly" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-white"}`}
					>
						Host only
					</button>
					<button
						type="button"
						onClick={() => setHostParticipation("hostAndParticipate")}
						className={`rounded-lg border px-3 py-2 text-sm ${hostParticipation === "hostAndParticipate" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-white"}`}
					>
						Host and participate
					</button>
				</div>
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-white">Strength</h2>
					<button
						type="button"
						onClick={() =>
							setStrengthBlocks((prev) => [
								...prev,
								{ blockId: newBlockId(), exerciseName: "" },
							])
						}
						className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-white"
					>
						<Plus size={14} /> Add
					</button>
				</div>
				{strengthBlocks.map((block, index) => (
					<div key={block.blockId} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
						<input
							value={block.exerciseName}
							onChange={(event) =>
								setStrengthBlocks((prev) =>
									prev.map((item, itemIndex) =>
										itemIndex === index
											? { ...item, exerciseName: event.target.value }
											: item,
									),
								)
							}
							className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white"
							placeholder="Exercise"
						/>
						<textarea
							value={block.instructions ?? ""}
							onChange={(event) =>
								setStrengthBlocks((prev) =>
									prev.map((item, itemIndex) =>
										itemIndex === index
											? { ...item, instructions: event.target.value }
											: item,
									),
								)
							}
							className="mt-2 min-h-16 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white"
							placeholder="5x5 @ 75% 1RM"
						/>
						<button
							type="button"
							onClick={() =>
								setStrengthBlocks((prev) =>
									prev.filter((item) => item.blockId !== block.blockId),
								)
							}
							className="mt-2 flex items-center gap-1.5 text-xs text-red-400"
						>
							<Trash2 size={13} /> Remove
						</button>
					</div>
				))}
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-white">WODs</h2>
					<button
						type="button"
						onClick={() =>
							setWodBlocks((prev) => [
								...prev,
								{
									blockId: newBlockId(),
									name: "",
									type: "forTime",
									levels: structuredClone(defaultLevels),
								},
							])
						}
						className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-white"
					>
						<Plus size={14} /> Add
					</button>
				</div>
				{wodBlocks.map((block, index) => (
					<div key={block.blockId} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
						<input
							value={block.name}
							onChange={(event) =>
								setWodBlocks((prev) =>
									prev.map((item, itemIndex) =>
										itemIndex === index ? { ...item, name: event.target.value } : item,
									),
								)
							}
							className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white"
							placeholder="WOD name"
						/>
						<div className="mt-2 grid grid-cols-2 gap-2">
							{(["forTime", "amrap", "emom", "load"] as const).map((type) => (
								<button
									key={type}
									type="button"
									onClick={() =>
										setWodBlocks((prev) =>
											prev.map((item, itemIndex) =>
												itemIndex === index ? { ...item, type } : item,
											),
										)
									}
									className={`rounded-lg border px-2 py-2 text-xs ${block.type === type ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-white"}`}
								>
									{type}
								</button>
							))}
						</div>
						{block.levels.map((level) => (
							<div key={level.level} className="mt-3 rounded-lg bg-[var(--surface-2)] p-3">
								<p className="text-xs font-semibold text-[var(--accent)]">
									{level.label}
								</p>
								<input
									value={level.movements[0]?.name ?? ""}
									onChange={(event) =>
										setWodBlocks((prev) =>
											prev.map((item, itemIndex) =>
												itemIndex === index
													? {
															...item,
															levels: item.levels.map((entry) =>
																entry.level === level.level
																	? {
																			...entry,
																			movements: [
																				{
																					...(entry.movements[0] ?? {}),
																					name: event.target.value,
																				},
																			],
																		}
																	: entry,
															),
														}
													: item,
											),
										)
									}
									className="mt-2 h-9 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 text-xs text-white"
									placeholder={`${level.label} prescription`}
								/>
							</div>
						))}
						<button
							type="button"
							onClick={() =>
								setWodBlocks((prev) =>
									prev.filter((item) => item.blockId !== block.blockId),
								)
							}
							className="mt-3 flex items-center gap-1.5 text-xs text-red-400"
						>
							<Trash2 size={13} /> Remove
						</button>
					</div>
				))}
			</div>

			{error && <p className="text-sm text-red-400">{error}</p>}
			<button
				type="submit"
				disabled={saving}
				className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
			>
				<Save size={15} /> {saving ? "Saving..." : "Save draft"}
			</button>
		</form>
	);
}
```

- [ ] **Step 2: Add host list route**

Create `src/routes/hosted-workouts/index.tsx`:

```tsx
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/hosted-workouts/")({
	component: HostedWorkoutsGuarded,
});

function HostedWorkoutsGuarded() {
	return (
		<>
			<SignedIn>
				<HostedWorkoutsPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function HostedWorkoutsPage() {
	const hosted = useQuery(api.hostedWorkouts.listMine) ?? [];
	return (
		<div className="mx-auto max-w-3xl p-4 sm:p-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold text-white">Hosted Workouts</h1>
				<Link
					to="/hosted-workouts/new"
					className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black"
				>
					<Plus size={15} /> Host
				</Link>
			</div>
			<div className="space-y-3">
				{hosted.map((item) => (
					<Link
						key={item._id}
						to="/hosted-workouts/$id"
						params={{ id: item._id }}
						className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
					>
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="font-semibold text-white">{item.title}</p>
								<p className="mt-1 text-xs text-[var(--text-muted)]">
									{item.scheduledAt
										? format(new Date(item.scheduledAt), "MMM d, h:mm a")
										: "No scheduled time"}
								</p>
							</div>
							<span className="rounded-full border border-[var(--border)] px-2 py-1 text-xs uppercase text-[var(--text-muted)]">
								{item.status}
							</span>
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}
```

- [ ] **Step 3: Add new hosted workout route**

Create `src/routes/hosted-workouts/new.tsx`:

```tsx
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HostedWorkoutBuilder } from "#/components/hosted/HostedWorkoutBuilder";

export const Route = createFileRoute("/hosted-workouts/new")({
	component: NewHostedWorkoutGuarded,
});

function NewHostedWorkoutGuarded() {
	return (
		<>
			<SignedIn>
				<NewHostedWorkoutPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function NewHostedWorkoutPage() {
	const navigate = useNavigate();
	return (
		<div className="mx-auto max-w-3xl p-4 sm:p-6">
			<h1 className="mb-6 text-2xl font-bold text-white">Host Workout</h1>
			<HostedWorkoutBuilder
				onCreated={(id) =>
					void navigate({ to: "/hosted-workouts/$id", params: { id } })
				}
			/>
		</div>
	);
}
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS and route tree generation includes hosted workout routes.

- [ ] **Step 5: Commit builder and routes**

```bash
git add src/components/hosted/HostedWorkoutBuilder.tsx src/routes/hosted-workouts/index.tsx src/routes/hosted-workouts/new.tsx src/routeTree.gen.ts
git commit -m "feat: add hosted workout builder"
```

---

### Task 8: Host Dashboard, QR, and Leaderboard

**Files:**
- Create: `src/components/hosted/HostedWorkoutQr.tsx`
- Create: `src/components/hosted/HostedLeaderboard.tsx`
- Create: `src/components/hosted/HostedWorkoutDashboard.tsx`
- Create: `src/routes/hosted-workouts/$id.tsx`

- [ ] **Step 1: Create QR component**

Create `src/components/hosted/HostedWorkoutQr.tsx`:

```tsx
import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";

export function HostedWorkoutQr({ url }: { url: string }) {
	return (
		<div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
			<div className="flex flex-col items-center gap-3">
				<div className="rounded-lg bg-white p-3">
					<QRCodeSVG value={url} size={176} />
				</div>
				<div className="flex w-full items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2">
					<span className="min-w-0 flex-1 truncate text-xs text-[var(--text-muted)]">
						{url}
					</span>
					<button
						type="button"
						onClick={() => void navigator.clipboard.writeText(url)}
						className="text-[var(--accent)]"
						aria-label="Copy hosted workout link"
					>
						<Copy size={15} />
					</button>
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Create leaderboard component**

Create `src/components/hosted/HostedLeaderboard.tsx`:

```tsx
import {
	formatHostedScore,
	getHostedLevelLabel,
	sortHostedLeaderboard,
	type HostedWodType,
} from "#/lib/hostedWorkouts";

type Submission = {
	_id: string;
	guestName?: string;
	wodBlockId: string;
	level: "rx" | "l1" | "l2" | "l3";
	timeSeconds?: number;
	rounds?: number;
	reps?: number;
	timeCapped?: boolean;
	load?: number;
	loadUnit?: "kg" | "lbs";
	submittedAt: number;
};

export function HostedLeaderboard({
	type,
	submissions,
	nameForSubmission,
}: {
	type: HostedWodType;
	submissions: Submission[];
	nameForSubmission: (submission: Submission) => string;
}) {
	const rows = sortHostedLeaderboard(
		type,
		submissions.map((submission) => ({
			id: submission._id,
			name: nameForSubmission(submission),
			level: submission.level,
			submittedAt: submission.submittedAt,
			score: submission,
		})),
	);
	return (
		<div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
			<div className="border-b border-[var(--border)] px-4 py-3">
				<h2 className="text-sm font-semibold text-white">Leaderboard</h2>
			</div>
			<div className="divide-y divide-[var(--border)]">
				{rows.map((row, index) => (
					<div key={row.id} className="flex items-center gap-3 px-4 py-3">
						<span className="w-6 text-sm tabular-nums text-[var(--text-muted)]">
							{index + 1}
						</span>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium text-white">{row.name}</p>
							<p className="text-xs text-[var(--text-muted)]">
								{getHostedLevelLabel(row.level)}
							</p>
						</div>
						<span className="text-sm font-semibold text-[var(--accent)]">
							{formatHostedScore(type, row.score)}
						</span>
					</div>
				))}
				{rows.length === 0 && (
					<p className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
						No submissions yet.
					</p>
				)}
			</div>
		</div>
	);
}
```

- [ ] **Step 3: Create host dashboard component**

Create `src/components/hosted/HostedWorkoutDashboard.tsx`:

```tsx
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Lock, Play, Square } from "lucide-react";
import { HostedLeaderboard } from "./HostedLeaderboard";
import { HostedWorkoutQr } from "./HostedWorkoutQr";

export function HostedWorkoutDashboard({ id }: { id: Id<"hostedWorkouts"> }) {
	const data = useQuery(api.hostedWorkouts.getMine, { id });
	const open = useMutation(api.hostedWorkouts.open);
	const close = useMutation(api.hostedWorkouts.close);

	if (data === undefined) {
		return <div className="p-6 text-sm text-[var(--text-muted)]">Loading...</div>;
	}
	if (data === null) {
		return <div className="p-6 text-sm text-red-400">Hosted workout not found.</div>;
	}

	const { hosted, participants, submissions } = data;
	const joinUrl = `${window.location.origin}/join/${hosted.joinToken}`;
	const firstWod = hosted.template.wodBlocks[0];

	return (
		<div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold text-white">{hosted.title}</h1>
					<p className="mt-1 text-sm text-[var(--text-muted)]">
						{hosted.status}
					</p>
				</div>
				{hosted.status === "draft" && (
					<button
						type="button"
						onClick={() => void open({ id })}
						className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black"
					>
						<Play size={15} /> Open
					</button>
				)}
				{hosted.status === "open" && (
					<button
						type="button"
						onClick={() => void close({ id })}
						className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-white"
					>
						<Square size={15} /> Close
					</button>
				)}
				{hosted.status === "closed" && (
					<div className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]">
						<Lock size={15} /> Closed
					</div>
				)}
			</div>

			{hosted.status !== "draft" && <HostedWorkoutQr url={joinUrl} />}

			<div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
				<h2 className="text-sm font-semibold text-white">Prescription</h2>
				<div className="mt-3 space-y-3">
					{hosted.template.strengthBlocks.map((block) => (
						<div key={block.blockId} className="rounded-lg bg-[var(--surface-2)] p-3">
							<p className="text-sm font-medium text-white">{block.exerciseName}</p>
							{block.instructions && (
								<p className="mt-1 text-xs text-[var(--text-muted)]">
									{block.instructions}
								</p>
							)}
						</div>
					))}
					{hosted.template.wodBlocks.map((block) => (
						<div key={block.blockId} className="rounded-lg bg-[var(--surface-2)] p-3">
							<p className="text-sm font-medium text-white">{block.name}</p>
							<div className="mt-2 grid gap-2 sm:grid-cols-2">
								{block.levels.map((level) => (
									<div key={level.level} className="rounded-lg border border-[var(--border)] p-2">
										<p className="text-xs font-semibold text-[var(--accent)]">
											{level.label}
										</p>
										<p className="mt-1 text-xs text-[var(--text-muted)]">
											{level.movements.map((movement) => movement.name).join(", ")}
										</p>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
				<h2 className="text-sm font-semibold text-white">Participants</h2>
				<p className="mt-2 text-2xl font-bold text-white">{participants.length}</p>
			</div>

			{firstWod && (
				<HostedLeaderboard
					type={firstWod.type}
					submissions={submissions.filter(
						(submission) => submission.wodBlockId === firstWod.blockId,
					)}
					nameForSubmission={(submission) =>
						submission.guestName ?? "Signed-in athlete"
					}
				/>
			)}
		</div>
	);
}
```

- [ ] **Step 4: Add dashboard route**

Create `src/routes/hosted-workouts/$id.tsx`:

```tsx
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { HostedWorkoutDashboard } from "#/components/hosted/HostedWorkoutDashboard";

export const Route = createFileRoute("/hosted-workouts/$id")({
	component: HostedWorkoutDashboardGuarded,
});

function HostedWorkoutDashboardGuarded() {
	const { id } = Route.useParams();
	return (
		<>
			<SignedIn>
				<HostedWorkoutDashboard id={id as Id<"hostedWorkouts">} />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}
```

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit dashboard**

```bash
git add src/components/hosted/HostedWorkoutQr.tsx src/components/hosted/HostedLeaderboard.tsx src/components/hosted/HostedWorkoutDashboard.tsx src/routes/hosted-workouts/\$id.tsx src/routeTree.gen.ts
git commit -m "feat: add hosted workout dashboard"
```

---

### Task 9: Public Join and Guest Submission UI

**Files:**
- Create: `src/components/hosted/GuestSubmissionForm.tsx`
- Create: `src/components/hosted/JoinHostedWorkout.tsx`
- Create: `src/routes/join/$token.tsx`

- [ ] **Step 1: Create guest submission form**

Create `src/components/hosted/GuestSubmissionForm.tsx`:

```tsx
import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";

type WodBlock = {
	blockId: string;
	name: string;
	type: "forTime" | "amrap" | "emom" | "load";
	levels: { level: "rx" | "l1" | "l2" | "l3"; label: string }[];
};

export function GuestSubmissionForm({
	token,
	wodBlock,
	onSubmitted,
}: {
	token: string;
	wodBlock: WodBlock;
	onSubmitted: () => void;
}) {
	const submitGuest = useMutation(api.hostedWorkoutSubmissions.submitGuest);
	const [guestName, setGuestName] = useState("");
	const [level, setLevel] = useState<"rx" | "l1" | "l2" | "l3">("rx");
	const [timeSeconds, setTimeSeconds] = useState("");
	const [rounds, setRounds] = useState("");
	const [reps, setReps] = useState("");
	const [load, setLoad] = useState("");
	const [loadUnit, setLoadUnit] = useState<"kg" | "lbs">("kg");
	const [error, setError] = useState("");

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError("");
		try {
			await submitGuest({
				token,
				guestName,
				wodBlockId: wodBlock.blockId,
				level,
				timeSeconds: timeSeconds ? Number(timeSeconds) : undefined,
				rounds: rounds ? Number(rounds) : undefined,
				reps: reps ? Number(reps) : undefined,
				load: load ? Number(load) : undefined,
				loadUnit: load ? loadUnit : undefined,
				rxScaled: level === "rx" ? "rx" : "scaled",
			});
			onSubmitted();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit score");
		}
	}

	return (
		<form onSubmit={(event) => void handleSubmit(event)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
			<h2 className="text-sm font-semibold text-white">Submit as guest</h2>
			<input
				value={guestName}
				onChange={(event) => setGuestName(event.target.value)}
				className="mt-3 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white"
				placeholder="Display name"
			/>
			<div className="mt-3 grid grid-cols-4 gap-2">
				{wodBlock.levels.map((entry) => (
					<button
						key={entry.level}
						type="button"
						onClick={() => setLevel(entry.level)}
						className={`rounded-lg border px-2 py-2 text-xs ${level === entry.level ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-white"}`}
					>
						{entry.label}
					</button>
				))}
			</div>
			{wodBlock.type === "forTime" && (
				<input
					value={timeSeconds}
					onChange={(event) => setTimeSeconds(event.target.value)}
					className="mt-3 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white"
					placeholder="Time in seconds"
					inputMode="numeric"
				/>
			)}
			{(wodBlock.type === "amrap" || wodBlock.type === "emom") && (
				<div className="mt-3 grid grid-cols-2 gap-2">
					<input
						value={rounds}
						onChange={(event) => setRounds(event.target.value)}
						className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white"
						placeholder="Rounds"
						inputMode="numeric"
					/>
					<input
						value={reps}
						onChange={(event) => setReps(event.target.value)}
						className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white"
						placeholder="Reps"
						inputMode="numeric"
					/>
				</div>
			)}
			{wodBlock.type === "load" && (
				<div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
					<input
						value={load}
						onChange={(event) => setLoad(event.target.value)}
						className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white"
						placeholder="Load"
						inputMode="decimal"
					/>
					<select
						value={loadUnit}
						onChange={(event) => setLoadUnit(event.target.value as "kg" | "lbs")}
						className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white"
					>
						<option value="kg">kg</option>
						<option value="lbs">lbs</option>
					</select>
				</div>
			)}
			{error && <p className="mt-2 text-xs text-red-400">{error}</p>}
			<button className="mt-3 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black">
				Submit score
			</button>
		</form>
	);
}
```

- [ ] **Step 2: Create public join component**

Create `src/components/hosted/JoinHostedWorkout.tsx`:

```tsx
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { GuestSubmissionForm } from "./GuestSubmissionForm";
import { HostedLeaderboard } from "./HostedLeaderboard";

export function JoinHostedWorkout({ token }: { token: string }) {
	const data = useQuery(api.hostedWorkouts.getByJoinToken, { token });
	const join = useMutation(api.hostedWorkoutParticipants.join);
	const navigate = useNavigate();
	const [message, setMessage] = useState("");

	if (data === undefined) {
		return <div className="p-6 text-sm text-[var(--text-muted)]">Loading...</div>;
	}
	if (data === null) {
		return <div className="p-6 text-sm text-red-400">Hosted workout not found.</div>;
	}

	const { hosted, submissions } = data;
	const firstWod = hosted.template.wodBlocks[0];
	const isOpen = hosted.status === "open";

	async function handleJoin() {
		const sessionId = await join({ token });
		void navigate({ to: "/log/$sessionId", params: { sessionId } });
	}

	return (
		<div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
			<div>
				<h1 className="text-2xl font-bold text-white">{hosted.title}</h1>
				<p className="mt-1 text-sm text-[var(--text-muted)]">
					{isOpen ? "Open for submissions" : "Closed"}
				</p>
			</div>
			<div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
				<h2 className="text-sm font-semibold text-white">Workout</h2>
				<div className="mt-3 space-y-2">
					{hosted.template.strengthBlocks.map((block) => (
						<div key={block.blockId} className="rounded-lg bg-[var(--surface-2)] p-3">
							<p className="text-sm font-medium text-white">{block.exerciseName}</p>
							{block.instructions && (
								<p className="text-xs text-[var(--text-muted)]">{block.instructions}</p>
							)}
						</div>
					))}
					{hosted.template.wodBlocks.map((block) => (
						<div key={block.blockId} className="rounded-lg bg-[var(--surface-2)] p-3">
							<p className="text-sm font-medium text-white">{block.name}</p>
							<p className="text-xs text-[var(--text-muted)]">{block.type}</p>
						</div>
					))}
				</div>
			</div>
			{isOpen ? (
				<>
					<SignedIn>
						<button
							type="button"
							onClick={() => void handleJoin()}
							className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-bold text-black"
						>
							Join and log in my account
						</button>
					</SignedIn>
					<SignedOut>
						<SignInButton mode="modal">
							<button
								type="button"
								className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-bold text-black"
							>
								Sign in to save to my account
							</button>
						</SignInButton>
					</SignedOut>
					{firstWod && (
						<GuestSubmissionForm
							token={token}
							wodBlock={firstWod}
							onSubmitted={() => setMessage("Score submitted.")}
						/>
					)}
				</>
			) : (
				<p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
					This hosted workout is closed. Results are view-only.
				</p>
			)}
			{message && <p className="text-sm text-[var(--accent)]">{message}</p>}
			{firstWod && (
				<HostedLeaderboard
					type={firstWod.type}
					submissions={submissions.filter(
						(submission) => submission.wodBlockId === firstWod.blockId,
					)}
					nameForSubmission={(submission) =>
						submission.guestName ?? "Signed-in athlete"
					}
				/>
			)}
		</div>
	);
}
```

- [ ] **Step 3: Add join route**

Create `src/routes/join/$token.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { JoinHostedWorkout } from "#/components/hosted/JoinHostedWorkout";

export const Route = createFileRoute("/join/$token")({
	component: JoinHostedWorkoutPage,
});

function JoinHostedWorkoutPage() {
	const { token } = Route.useParams();
	return <JoinHostedWorkout token={token} />;
}
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit public join UI**

```bash
git add src/components/hosted/GuestSubmissionForm.tsx src/components/hosted/JoinHostedWorkout.tsx src/routes/join/\$token.tsx src/routeTree.gen.ts
git commit -m "feat: add hosted workout join flow"
```

---

### Task 10: Hosted Plan Inside Personal Session

**Files:**
- Create: `src/components/session/HostedSessionPlan.tsx`
- Modify: `src/routes/log/$sessionId.tsx`

- [ ] **Step 1: Create hosted session plan component**

Create `src/components/session/HostedSessionPlan.tsx`:

```tsx
import { getHostedLevelLabel } from "#/lib/hostedWorkouts";

type HostedContext = {
	hosted: {
		title: string;
		template: {
			strengthBlocks: {
				blockId: string;
				exerciseName: string;
				instructions?: string;
				defaultSets?: number;
				defaultReps?: number;
				defaultWeight?: number;
				unit?: "kg" | "lbs";
				percentageOfOneRepMax?: number;
			}[];
			wodBlocks: {
				blockId: string;
				name: string;
				levels: {
					level: "rx" | "l1" | "l2" | "l3";
					label: string;
					movements: { name: string; notes?: string }[];
				}[];
			}[];
		};
	};
};

export function HostedSessionPlan({ context }: { context: HostedContext }) {
	const { hosted } = context;
	return (
		<div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
			<p className="text-xs font-semibold uppercase text-[var(--accent)]">
				Hosted workout
			</p>
			<h2 className="mt-1 text-lg font-bold text-white">{hosted.title}</h2>
			<div className="mt-4 space-y-3">
				{hosted.template.strengthBlocks.map((block) => (
					<div key={block.blockId} className="rounded-lg bg-[var(--surface-2)] p-3">
						<p className="text-sm font-medium text-white">{block.exerciseName}</p>
						{block.instructions && (
							<p className="mt-1 text-xs text-[var(--text-muted)]">
								{block.instructions}
							</p>
						)}
						{block.defaultSets && block.defaultReps && (
							<p className="mt-1 text-xs text-[var(--accent)]">
								Planned: {block.defaultSets} x {block.defaultReps}
								{block.defaultWeight
									? ` @ ${block.defaultWeight} ${block.unit ?? "kg"}`
									: ""}
							</p>
						)}
						{block.percentageOfOneRepMax && (
							<p className="mt-1 text-xs text-[var(--accent)]">
								{block.percentageOfOneRepMax}% 1RM
							</p>
						)}
					</div>
				))}
				{hosted.template.wodBlocks.map((block) => (
					<div key={block.blockId} className="rounded-lg bg-[var(--surface-2)] p-3">
						<p className="text-sm font-medium text-white">{block.name}</p>
						<div className="mt-2 grid gap-2 sm:grid-cols-2">
							{block.levels.map((level) => (
								<div key={level.level} className="rounded-lg border border-[var(--border)] p-2">
									<p className="text-xs font-semibold text-[var(--accent)]">
										{getHostedLevelLabel(level.level)}
									</p>
									<p className="mt-1 text-xs text-[var(--text-muted)]">
										{level.movements.map((movement) => movement.name).join(", ")}
									</p>
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Render hosted plan in active session route**

Modify `src/routes/log/$sessionId.tsx`:

Add import:

```ts
import { HostedSessionPlan } from "#/components/session/HostedSessionPlan";
```

Add query inside `ActiveSessionPage` after the `sets` query:

```ts
	const hostedContext = useQuery(api.hostedWorkoutParticipants.getBySession, {
		sessionId: sessionId as Id<"workoutSessions">,
	});
```

Render the plan above the exercise list:

```tsx
			{hostedContext && <HostedSessionPlan context={hostedContext} />}
```

Place it after the session header buttons and before:

```tsx
			<div className="flex flex-col gap-4 mb-6">
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit session integration**

```bash
git add src/components/session/HostedSessionPlan.tsx src/routes/log/\$sessionId.tsx
git commit -m "feat: show hosted plan in workout sessions"
```

---

### Task 11: Signed-In Hosted WOD Submission From Session

**Files:**
- Modify: `src/components/session/SessionWods.tsx`
- Modify: `src/routes/log/$sessionId.tsx`

- [ ] **Step 1: Pass hosted context to session WOD UI**

Modify the `SessionWods` call in `src/routes/log/$sessionId.tsx`:

```tsx
			<SessionWods
				sessionId={sessionId as Id<"workoutSessions">}
				hostedContext={hostedContext ?? null}
			/>
```

- [ ] **Step 2: Add hosted submission support in `SessionWods`**

Modify `src/components/session/SessionWods.tsx`:

Change the props type:

```ts
export function SessionWods({
	sessionId,
	hostedContext,
}: {
	sessionId: Id<"workoutSessions">;
	hostedContext?: {
		participant: { _id: Id<"hostedWorkoutParticipants"> };
		hosted: {
			template: {
				wodBlocks: {
					blockId: string;
					name: string;
					type: "forTime" | "amrap" | "emom" | "load";
					levels: { level: "rx" | "l1" | "l2" | "l3"; label: string }[];
				}[];
			};
		};
	} | null;
}) {
```

Import `useMutation` and add:

```ts
	const submitHosted = useMutation(
		api.hostedWorkoutSubmissions.submitForParticipant,
	);
	const [hostedWodId, setHostedWodId] = useState<string | null>(null);
```

Before the existing "Add WOD" button, render hosted WOD buttons:

```tsx
			{hostedContext?.hosted.template.wodBlocks.map((block) => (
				<button
					key={block.blockId}
					type="button"
					onClick={() => setHostedWodId(block.blockId)}
					className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-sm text-white"
				>
					Log hosted WOD: {block.name}
				</button>
			))}
```

For v1, when `hostedWodId` is set, show a compact score form with level and type-relevant fields. Use this minimal block inside the component before the existing selected WOD form:

```tsx
			{hostedWodId && hostedContext && (
				<HostedInlineWodForm
					block={hostedContext.hosted.template.wodBlocks.find(
						(block) => block.blockId === hostedWodId,
					)}
					onCancel={() => setHostedWodId(null)}
					onSubmit={async (payload) => {
						await submitHosted({
							participantId: hostedContext.participant._id,
							wodBlockId: hostedWodId,
							...payload,
						});
						setHostedWodId(null);
					}}
				/>
			)}
```

Add the local `HostedInlineWodForm` component at the bottom of the file:

```tsx
function HostedInlineWodForm({
	block,
	onCancel,
	onSubmit,
}: {
	block:
		| {
				blockId: string;
				name: string;
				type: "forTime" | "amrap" | "emom" | "load";
				levels: { level: "rx" | "l1" | "l2" | "l3"; label: string }[];
		  }
		| undefined;
	onCancel: () => void;
	onSubmit: (payload: {
		level: "rx" | "l1" | "l2" | "l3";
		rxScaled: "rx" | "scaled";
		timeSeconds?: number;
		rounds?: number;
		reps?: number;
		load?: number;
		loadUnit?: "kg" | "lbs";
	}) => Promise<void>;
}) {
	const [level, setLevel] = useState<"rx" | "l1" | "l2" | "l3">("rx");
	const [value, setValue] = useState("");
	if (!block) return null;
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				const numeric = Number(value);
				const payload =
					block.type === "forTime"
						? { timeSeconds: numeric }
						: block.type === "load"
							? { load: numeric, loadUnit: "kg" as const }
							: { reps: numeric };
				void onSubmit({
					level,
					rxScaled: level === "rx" ? "rx" : "scaled",
					...payload,
				});
			}}
			className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
		>
			<h3 className="text-sm font-semibold text-white">{block.name}</h3>
			<div className="mt-3 grid grid-cols-4 gap-2">
				{block.levels.map((entry) => (
					<button
						key={entry.level}
						type="button"
						onClick={() => setLevel(entry.level)}
						className={`rounded-lg border px-2 py-2 text-xs ${level === entry.level ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-white"}`}
					>
						{entry.label}
					</button>
				))}
			</div>
			<input
				value={value}
				onChange={(event) => setValue(event.target.value)}
				className="mt-3 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white"
				placeholder={
					block.type === "forTime"
						? "Time in seconds"
						: block.type === "load"
							? "Load in kg"
							: "Reps"
				}
				inputMode="numeric"
			/>
			<div className="mt-3 grid grid-cols-2 gap-2">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-white"
				>
					Cancel
				</button>
				<button className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-bold text-black">
					Submit
				</button>
			</div>
		</form>
	);
}
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit signed-in hosted WOD submission**

```bash
git add src/components/session/SessionWods.tsx src/routes/log/\$sessionId.tsx
git commit -m "feat: submit hosted wod results from sessions"
```

---

### Task 12: Polish, Verification, and Manual Smoke Test

**Files:**
- Modify files touched by earlier tasks only when verification reveals specific failures.

- [ ] **Step 1: Run unit tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run Biome**

Run: `npx biome check .`

Expected: PASS. Fix formatting, import order, and lint issues reported by Biome.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Start the app locally**

Run: `npm run dev`

Expected: Vite prints a local URL such as `http://localhost:5173/`.

- [ ] **Step 5: Manual smoke test in browser**

Use the local URL and verify:

1. `/hosted-workouts` loads for a signed-in user.
2. Creating a hosted workout with one strength block and one WOD saves a draft.
3. Opening the draft shows a QR and join URL.
4. `/join/$token` shows the prescription while open.
5. Guest submission with display name appears on the leaderboard.
6. Signed-in join creates a personal active session and redirects to `/log/$sessionId`.
7. The personal session shows the hosted plan but no fake completed sets.
8. Signed-in hosted WOD submission appears in the host leaderboard.
9. Closing the hosted workout disables guest submission and signed-in join.

- [ ] **Step 6: Final status check**

Run: `git status --short`

Expected: no uncommitted changes after the final commit, or only intentional untracked local runtime files.

---

## Self-Review Notes

- Spec coverage: Tasks cover schema, host ownership, QR join token, open/closed status, signed-in participant sessions, guest submissions, hosted leaderboard, Rx/L1/L2/L3 snapshots, and hosted plan rendering without fake `sets`.
- Placeholder scan: This plan contains no unresolved markers, no future-only implementation placeholders, and no unspecified route choices.
- Type consistency: The plan uses `hostedWorkouts`, `hostedWorkoutParticipants`, `hostedWorkoutSubmissions`, `hostParticipation`, `joinToken`, `wodBlockId`, and `level` consistently across schema, Convex APIs, and React components.

