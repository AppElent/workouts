# Improvements Assessment

> Assessment date: 2026-06-22. A grounded review of the workout-tracking app
> (Convex + TanStack Start) covering competitive positioning, functionality
> gaps, and technical improvements. File/line references reflect the codebase
> at the time of writing — verify before acting on the older ones.

## Summary

The app is a Convex + TanStack Start workout tracker: strength logging
(sessions / sets / 1RM / routines), an exercise library, basic progress charts,
and a CrossFit WOD module (`wods` + `wodResults`). Its natural positioning is
**"Hevy + a SugarWOD-lite WOD layer"** — strength *and* CrossFit metcons in one
app, a genuinely underserved niche. That combination is the wedge worth leaning
into.

## Competitive landscape

| App | Core strength | What it has that we lack |
| --- | --- | --- |
| **Hevy** | Strength logging UX | Rest timer, templates with supersets, plate calculator, RIR/RPE, social feed, CSV import/export, Apple Health sync |
| **Strong** | Polished logging | Per-exercise history graphs, warmup calculator, body measurements, Apple Watch app |
| **Fitbod** | AI programming | Auto-generated next workout from recovery + muscle-fatigue heatmap |
| **JEFIT / Boostcamp** | Programs | Multi-week structured programs (5/3/1, PPL) with progression logic |
| **SugarWOD / BTWB** (CrossFit) | WOD-specific | Benchmark leaderboards, Girl/Hero WOD library, RX vs scaled, barbell-lift PRs alongside metcons, box/community feeds |

## Functionality gaps (highest user value first)

1. **Rest timer** — table-stakes for a logging app, currently absent. Auto-start
   on set log, configurable per exercise.
2. **Per-exercise history & PR detection in the UI** — 1RMs are computed
   server-side, but `convex/progress.ts` only exposes `weeklyVolume` for a
   single exercise. No "best set ever," rep-PRs (3RM/5RM), or per-movement
   volume-over-time surfaced. CrossFit users also expect WOD PR history
   ("beat your Fran time by 0:22").
3. **Structured programs / progression** — routines are flat exercise lists
   (`defaultSets/Reps/Weight`). No multi-week programming, no auto-progression
   (e.g. +2.5 kg next session). The biggest retention lever the leaders have.
4. **Bodyweight & measurements tracking** — no table for it. Cheap to add, high
   engagement.
5. **WOD leaderboards / benchmark comparison** — benchmark WODs are already
   seeded; comparing your Fran time against an (anonymized) distribution is the
   SugarWOD hook.
6. **Plate / barbell calculator + warmup sets** — small, well-loved features.
7. **Supersets / circuits** — neither sessions nor routines model grouped
   exercises.
8. **Data export (CSV/JSON)** — trust feature and an easy win.
9. **Health-platform sync** (Apple Health / Google Fit / Strava) — large reach
   but heavy; later.

## Technical improvements (grounded in the code)

1. **Dead demo scaffolding still shipped.** `convex/schema.ts` keeps `products`
   and `todos` tables, and `src/routes/demo/clerk.tsx` + `demo/convex.tsx` are
   live routes. Remove — extra surface area and confusion.
2. **N+1 query on the dashboard.** `src/routes/dashboard/index.tsx` renders up
   to 10 `ExerciseOrmRow`s, each firing its own
   `useQuery(oneRepMaxes.getCurrentForExercise)` — 10 round-trips for one panel.
   Add a single `oneRepMaxes.listCurrentForUser` query returning all current
   1RMs at once.
3. **Full-scan analytics.** `progress.weeklyVolume` does
   `.query('sets').withIndex('by_exercise').collect()` then filters by `userId`
   in JS — it pulls every user's sets for the exercise and discards most. Use a
   user-scoped access path (`by_user` / `by_session_exercise`) and consider a
   date-bounded index. The same `.collect().filter(userId)` antipattern recurs
   in `workoutSessions.remove`. This is the first scaling wall.
4. **1RM dual-maintenance risk.** Epley logic lives in both
   `src/lib/oneRepMax.ts` and `convex/lib/oneRepMax.ts` (and now the same split
   for `wodScore`). No test asserts the two stay identical. Add a parity test or
   extract a shared package — drift corrupts user PRs silently.
5. **WOD `userId: ''` sentinel.** Documented and safe today, but it's an
   implicit coupling spread across `wods.list/getById` and `deleteUserData`.
   Prefer querying on the existing `isDefault` discriminator exclusively rather
   than the empty string before more code depends on the sentinel.
6. **Thin server-side input validation.** Reps/weight/time accept any number
   (negative weight, 10,000-rep sets). Add range guards in the mutations to
   mirror the client-side Zod checks.
7. **Test coverage is thin and partly red.** Pure scoring modules are
   well-tested, but a pre-existing suite fails (`Select.test.tsx`, Base UI
   `useContext` null) and there are no integration/route tests. Fix the red test
   and add `convex-test` coverage for the cascade-delete logic (the riskiest
   backend code).
8. **Offline.** `OfflineBanner` exists but there's no offline write queue. Gym
   connectivity is genuinely poor — a local optimistic queue would be a real
   differentiator for a gym app.

## Recommended order

**Quick wins (days):** remove demo tables/routes → fix dashboard N+1 → rest
timer → bodyweight tracking → CSV export.

**Medium (1–2 weeks each):** per-exercise history + PR detection UI, WOD PR
history, plate calculator + warmup sets, analytics index/query rework.

**Big bets (the moat):** structured multi-week programs with auto-progression,
and WOD benchmark leaderboards. These turn a logger into a retained product —
and the strength + CrossFit combo is a genuinely underserved niche.
