# CrossFit WOD Logging — Design

**Date:** 2026-06-20
**Status:** Approved (design); ready for implementation plan

## Problem

The app's logging model is strictly **set-based**: every logged unit is a `set` with reps + weight + unit + setType, and the analytics layer (1RM, progress) is built on top of that. This fits strength/bodybuilding training well.

CrossFit "workout of the day" (WOD) training does not fit this shape. A WOD is a 20–25 minute metcon whose result is usually a **single score** — a finish time (For Time), or rounds+reps (AMRAP) — not a stream of weighted sets. WODs are also composed of prescribed movements (e.g. "21-15-9 thrusters @43kg and pull-ups"), many of which (running, rowing, double-unders) have no meaningful reps/weight.

We need a way to define WODs, log results against them, and compare results over time (benchmark PRs like Fran, Cindy, Murph).

## Decisions (from brainstorming)

1. **Full structured prescription** — WODs define their movements with prescribed reps/weights, track Rx vs Scaled, and support result comparison over time.
2. **Score types supported:** For Time, AMRAP, EMOM, Load/Max.
3. **Session model: flexible** — a WOD result can be logged standalone *or* attached to a `workoutSession` that also holds strength sets (mirrors how CrossFit classes vary: pure-metcon days vs. strength + metcon days).
4. **WOD identity: a WOD library** — WODs are saved definitions (like routines). Benchmarks are pre-seeded; users add their own. Results are logged against a definition; comparison groups all results for that WOD. Daily one-offs get a definition via quick-create.
5. **Movements: structured free-text** — each movement is a name + optional reps/weight/distance/calories, self-contained in the WOD definition. No dependency on the `exercises` table.

## Non-goals (YAGNI)

- Full structuring of every rep-scheme variant (ladders, "death by", complex chippers) — captured as free-text `repScheme` + the movements array.
- Rx vs Scaled affecting ranking — recorded and displayed, but does not change PR ranking in v1.
- Feeding WOD movements into the strength 1RM/progress system.
- Changes to `sets`, `exercises`, `oneRepMaxes`, or `progress.ts`. The feature is fully additive.

## Data model (Convex schema)

Two new tables, separate from `sets`/`exercises` so no 1RM/strength machinery is disturbed.

### `wods` — the WOD library (definitions)

```
wods:
  userId: string              // owner; benchmarks use isDefault like exercises
  name: string                // "Fran", "Monday Metcon", etc.
  type: "forTime" | "amrap" | "emom" | "load"
  description?: string        // raw WOD text / coach notes
  repScheme?: string          // free-text, e.g. "21-15-9"
  timeCapSeconds?: number     // For Time cap
  durationSeconds?: number    // AMRAP / EMOM total window
  movements: [{
    name: string              // "Thruster", "Pull-up", "Run", "Row"
    reps?: number
    weight?: number
    unit?: "kg" | "lbs"
    distance?: number
    distanceUnit?: "m" | "km" | "mi" | "cal"
    notes?: string
  }]
  isDefault: boolean          // seeded benchmark
  // indexes: by_user, by_default, by_name
```

### `wodResults` — logged attempts (compared over time)

```
wodResults:
  userId: string
  wodId: Id<"wods">
  sessionId?: Id<"workoutSessions">   // null = standalone; set = attached to a session
  date: number
  rxScaled: "rx" | "scaled"
  // score fields — only those relevant to the WOD's type are filled:
  timeSeconds?: number        // For Time finish
  rounds?: number             // AMRAP rounds
  reps?: number               // AMRAP extra reps / EMOM total reps / For-Time tiebreak when capped
  timeCapped?: boolean        // hit the cap without finishing
  load?: number               // Load/Max
  loadUnit?: "kg" | "lbs"
  notes?: string
  // indexes: by_user, by_wod, by_user_wod (comparison), by_session
```

**Notes:**
- Benchmarks are seeded `wods` with `isDefault: true`, readable by everyone (mirrors default exercises).
- Score stored as typed optional fields rather than one polymorphic blob — explicit, queryable, simple comparison.

## Backend API (Convex functions)

All guarded by `requireUser`; benchmarks readable by all (mirrors `exercises.ts` / `routines.ts`).

### `convex/wods.ts` — WOD definitions
- `list` — user's WODs + seeded benchmarks.
- `getById` — definition + movements (benchmark or owned).
- `create` — new WOD definition.
- `update` / `remove` — owned WODs only. **`remove` cascades**: also deletes the WOD's `wodResults` (mirrors `workoutSessions.remove` cascading sets). UI confirms when results exist.
- `quickCreate` — lightweight create for the "log a one-off daily WOD on the fly" flow.

### `convex/wodResults.ts` — logged attempts
- `log` — insert a result against a `wodId`, optional `sessionId`, type-relevant score fields, `rxScaled`, notes.
- `listForWod` — all results for one WOD via `by_user_wod`, ordered by date → comparison/history view.
- `listRecent` — recent results across all WODs (dashboard/history).
- `getBest` — PR for a WOD, using the shared scoring comparator.
- `update` / `remove` — owned results only.

### `convex/seed.ts` — extend existing seeder
- Add benchmark WODs: **Fran, Cindy, Helen, Grace, Annie, Diane, Karen, Murph** — each with proper `type`, `repScheme`, and structured `movements`.

## Frontend & UX

### Routes (`src/routes/`)
- `wods/index.tsx` — **WOD library**: "Benchmarks" and "My WODs" sections, "Create WOD" button, search. Cards show name, type badge, rep scheme.
- `wods/$id.tsx` — **WOD detail**: prescription (movements, scheme, time cap) on top; **result history** below with PR badge and a Recharts trend; primary "Log result" button.

### Logging flows (both)
- **Standalone**: from a WOD detail page → `LogWodResultForm` → `sessionId` null.
- **Within a session**: on `/log/$sessionId`, an **"Add WOD"** action beside "Add exercise" → pick/quick-create a WOD → log result with `sessionId` set. A CrossFit class = one session with both strength sets and the metcon.

### Components (`src/components/wods/`)
- `WodCard.tsx` — library list item.
- `CreateWodForm.tsx` — TanStack Form + Zod; type selector drives which fields show (time cap vs duration); dynamic movements editor.
- `LogWodResultForm.tsx` — **score input adapts to WOD type**: For Time → mm:ss + "capped?" toggle; AMRAP → rounds + reps steppers; EMOM → total reps / completed; Load → weight + unit. Plus Rx/Scaled toggle and notes. Reuses existing `Stepper`.
- `WodResultHistory.tsx` — past attempts + PR highlight + trend chart.

### Navigation & summary
- Add **"WODs"** to `Sidebar.tsx` and `BottomTabBar.tsx` (Lucide icon, e.g. `Timer`/`Flame`); Spotify-dark styling + `pb-16 sm:pb-0`.
- `SessionSummary.tsx` shows a WOD block when the finished session has an attached `wodResult` (score + Rx/Scaled).

## Scoring & comparison logic

### `src/lib/wodScore.ts` (pure, client-side)

- **`formatScore(type, result)` → string**:
  - For Time → `"3:21"` (or `"CAP+12"` when `timeCapped`)
  - AMRAP → `"6 + 14"` (rounds + reps)
  - EMOM → `"180 reps"` / `"completed"`
  - Load → `"95 kg"`

- **`scoreRank(type, result)` → number** — single comparable value, normalized so **higher = better**:
  - **For Time**: faster is better (rank from negative time). A finished result always beats a capped one; among capped, more reps = better.
  - **AMRAP**: `rounds * LARGE + reps`, higher better.
  - **EMOM**: total reps (or 1/0 for completed), higher better.
  - **Load**: weight (normalized to kg), higher better.

`getBest` in `wodResults.ts` reuses this comparator via a thin server mirror (kept in sync, like the existing `oneRepMax.ts` client/server split).

### Edge cases
- **Time cap not reached** — `timeCapped: true` + `reps` tiebreak; ranked below any finish.
- **Unit mismatch (Load)** — compare normalized to kg inside `scoreRank`.
- **Rx vs Scaled** — recorded and shown; does not alter ranking in v1.
- **Deleting a WOD** with results → cascade-delete results, with UI confirm.
- **Empty history** — detail page shows prescription + "Log your first result" CTA.

## Testing
- **`src/lib/wodScore.test.ts`** (Vitest) — `formatScore` and `scoreRank` across all 4 types, including capped-vs-finished ordering and kg/lbs Load normalization. Pure logic, no mocks.
- Uses existing `npm run test` / Vitest setup; no new infra.
