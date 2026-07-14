---
name: verify
description: Verify a code change in the workouts app by driving it through the real running app (dev server + Convex backend), not just typecheck/lint/test. Use before claiming a fix or feature is done.
---

# Verify (workouts)

Local-first: use `pnpm dev:watch` (Convex + Vite) and drive the change through
the actual UI/API surface it touches. On web sessions without Convex/Clerk
runtime credentials, verification falls back to the static suite
(`pnpm run check`, `pnpm run typecheck`, `pnpm test`, `pnpm build`) — say so
explicitly rather than claiming the feature itself was verified.

## Logging in

The sign-in screen shows a "▶ Dev: log in as test user" button (from
`@appelent/auth`'s `TestLoginButton`) whenever `VITE_CLERK_PUBLISHABLE_KEY` is
a Clerk **test** key (`pk_test_...`, never `pk_live_...`) *and* both
`VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` are set in `.env.local`. Use
it to authenticate when verifying auth-gated pages — don't assume a real
Clerk login is required. If the button isn't showing, check `.env.local` for
those two vars before concluding the app can't be tested logged-in.

## Route → module map

<!-- TODO: fill in as routes are verified. Never guess this table. -->

| Route | Convex module(s) | Notes |
| --- | --- | --- |
| `/dashboard` | TODO | |
| `/exercises`, `/exercises/$id` | `convex/exercises.ts` | |
| `/log`, `/log/$sessionId` | `convex/workoutSessions.ts`, `convex/sets.ts` | real-time session |
| `/routines` | `convex/routines.ts` | |
| `/progress` | `convex/progress.ts`, `convex/oneRepMaxes.ts` | |
| `/profile` | TODO | |
