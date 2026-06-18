# Hybrid Public/Authenticated Access — Design

**Date:** 2026-06-17
**Status:** Approved (pending spec review)

## Problem

The app today is split hard in two: an open landing page (`/`) and a fully gated
application. Every route except `/` and `/login` requires sign-in. We want a
**hybrid** model: the exercise library is browsable by anyone, while logging,
tracking, and all personal data stay behind authentication.

## Access Model

| Route | Logged out | Logged in |
|---|---|---|
| `/` (landing), `/login` | Public, bare layout (unchanged) | unchanged |
| `/exercises` | **Public** — default catalog, browse/filter | + user exercises, add/delete |
| `/exercises/$id` | **Public** — generic info + sign-in nudge on personal tabs | + personal Progress/History |
| `/dashboard`, `/log`, `/log/$sessionId`, `/routines`, `/progress`, `/profile` | **Gated** → redirect to sign-in (unchanged) | unchanged |

## Backend (Convex) — No Changes Required

The backend is already hybrid-ready:

- `exercises.list` returns default exercises (`isDefault: true`) to anonymous
  callers, and merges in user exercises only when authenticated.
- `exercises.getById` returns default exercises to anonymous callers; user-owned
  exercises return `null` unless the caller owns them.
- `workoutSessions.getActive` returns `null` when unauthenticated (no throw), so
  `AppShell` and `ActiveSessionBar` are safe to render for anonymous users.
- Personal queries (`exercises.getHistory`, `oneRepMaxes.*`) require auth and
  will be **skipped** client-side when signed out (`useQuery(..., "skip")`),
  never invoked anonymously.

No schema, query, or mutation changes are part of this work.

## Frontend Changes

### 1. Navigation shell (adapted app shell)

`AppShell` already wraps every non-landing route, including `/exercises`. It
stays the chrome for public pages too. Auth state is read via Clerk's
`<SignedIn>` / `<SignedOut>` components (consistent with existing patterns) so
SSR and the auth-loading state are handled gracefully.

**`src/components/Sidebar.tsx`**
- Gated nav items (Dashboard, Log, Routines, Progress, Profile) render in a
  **locked state** when signed out: dimmed styling + a lock icon. Clicking a
  locked item navigates to `/login`.
- `Exercises` remains a normal, active link in all states.
- The footer `<UserButton />` is shown only when signed in; when signed out it is
  replaced by a **"Sign In"** button linking to `/login`.

**`src/components/BottomTabBar.tsx`**
- Same locked-state treatment for gated tabs when signed out; locked tabs route
  to `/login`. `Exercises` stays active.

### 2. Exercises list — `src/routes/exercises/index.tsx`

- Remove the `ExercisesPageGuarded` wrapper (`SignedIn` / `RedirectToSignIn`);
  render `ExercisesPage` for everyone.
- Wrap the **add-exercise FAB** and the per-card **delete buttons** in
  `<SignedIn>` so they only appear when authenticated.
- Search, filters, and the card grid are unchanged. `exercises.list` already
  returns the right data for both states.

### 3. Exercise detail — `src/routes/exercises/$id.tsx`

- Remove the `ExerciseDetailPageGuarded` wrapper.
- **Overview tab**: always rendered (name, muscle map, category, equipment,
  notes) — all from `exercises.getById`, which works anonymously.
- **Progress & History tabs**: remain visible. When signed out:
  - Skip the personal queries: `getHistory`, `getCurrentForExercise`,
    `listForExercise` are called with `"skip"`.
  - Render a sign-in empty-state in place of the charts/table — a short prompt
    ("Sign in to track your progress" / "Sign in to see your set history") with
    a **Sign In** CTA linking to `/login`.

### 4. Landing page nudge — `src/routes/index.tsx`

- Add a secondary **"Browse exercises"** link to `/exercises` near the existing
  "Start Logging →" CTA, so the public surface is discoverable from the landing
  page. The primary "Start Logging →" CTA continues to point at `/log` (which
  redirects to sign-in when logged out).

## Out of Scope

- Convex schema, queries, and mutations (already hybrid-ready).
- The existing guards on `/dashboard`, `/log`, `/routines`, `/progress`,
  `/profile`.
- Clerk / Convex provider setup.
- Any redesign of the exercise pages beyond the gating described above.

## Testing / Verification

- **Logged out**: `/exercises` lists default exercises; no add FAB, no delete
  buttons; gated sidebar/tab items are locked and route to `/login`; the footer
  shows a Sign In button. `/exercises/$id` shows Overview; Progress/History show
  the sign-in nudge with no console errors from skipped queries.
- **Logged in**: `/exercises` shows defaults + user exercises with add/delete;
  gated nav items are normal links; UserButton appears; detail tabs show
  personal data as before.
- **Gated routes** still redirect anonymous users to sign-in.
- Verify in the browser preview at both viewport sizes (sidebar + bottom bar),
  and run `npm run check` / `npm run test`.
