# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Model routing

- Architecture, debugging, security review: Opus
- Implementation, content, standard coding: Sonnet
- File search, formatting, renaming, exploration: Haiku
- Always escalate security-sensitive changes to Opus for review

## Commands

```bash
npm run dev:all    # Start both Convex dev server and Vite concurrently (recommended)
npm run dev        # Start Vite dev server only (port 3000, all interfaces)
npm run build      # Production build (Vite)
npm run build:development  # Vite build with --mode development
npm run build:staging      # Vite build with --mode staging
npm run preview    # Build (dev mode) + start local Cloudflare Workers dev server
npm run test       # Run all tests with Vitest
npm run lint       # Biome linter
npm run format     # Biome formatter
npm run check      # Biome lint + format check combined
npm run deploy           # Production build + deploy to Cloudflare (prod)
npm run deploy:dev       # Dev build + deploy to Cloudflare (dev env)
npm run deploy:staging   # Staging build + deploy to Cloudflare (stg env)
npm run cf-typegen       # Generate Cloudflare Workers TypeScript types
```

To run a single test file: `npx vitest run src/path/to/test.ts`

**Development note**: `npm run dev:all` is the recommended way to start development — it runs `npx convex dev` and `vite dev` concurrently. Both must be running for full functionality; Convex won't be available with `npm run dev` alone.

**Preview note**: `npm run preview` does a full `build:development` then launches a local Cloudflare Workers dev server via `wrangler dev`. It is not a quick Vite preview — it simulates the production Workers runtime locally. Environment variables are injected by Wrangler from `wrangler.jsonc`.

## Architecture

Single codebase split into two layers:

- **`src/`** — React 19 frontend with TanStack React Start (SSR, file-based routing via TanStack Router)
- **`convex/`** — Serverless backend: database schema, queries, mutations, actions

The app is server-side rendered via TanStack React Start and deployed as a Cloudflare Worker. The server entry point is `@tanstack/react-start/server-entry`. Deployment environments (production, dev, stg) are defined in `wrangler.jsonc`.

### Tech Stack

| Layer            | Technology                                        |
| ---------------- | ------------------------------------------------- |
| UI Framework     | React 19 + TanStack React Start (SSR)             |
| Routing          | TanStack Router (file-based, part of React Start) |
| Hosting          | Cloudflare Workers (via Wrangler)                 |
| Backend          | Convex (serverless, real-time)                    |
| Auth             | Clerk                                             |
| Styling          | Tailwind CSS v4 + CVA                             |
| UI Primitives    | Base UI (unstyled, accessible)                    |
| Charts           | Recharts                                          |
| Forms            | TanStack Form + Zod                               |
| Date utilities   | date-fns                                          |
| Icons            | Lucide React                                      |
| Linter/Formatter | Biome                                             |
| Test Runner      | Vitest                                            |

### Data Flow

```
Clerk (auth) → JWT → Convex backend → real-time subscriptions → React components
```

All Convex functions require auth. The Convex client is initialized in `src/integrations/convex/provider.tsx` and authenticated via Clerk's JWT token (`convex/auth.config.ts`). The Clerk provider wraps the Convex provider in the component tree.

### Routing

Routes live in `src/routes/` and use TanStack Router's file-based convention:

```
src/routes/
├── __root.tsx          # Root layout: theme init, providers, active session redirect
├── index.tsx           # Home/landing page
├── dashboard/index.tsx # Main dashboard
├── exercises/
│   ├── index.tsx       # Exercise library & management
│   └── $id.tsx         # Individual exercise detail
├── log/
│   ├── index.tsx       # Workout logging interface
│   └── $sessionId.tsx  # Active workout session (real-time)
├── login/index.tsx     # Login (Clerk)
├── profile/index.tsx   # User profile
├── progress/index.tsx  # Progress analytics & charts
├── routines/index.tsx  # Routine management
└── demo/
    ├── clerk.tsx       # Clerk integration demo
    └── convex.tsx      # Convex integration demo
```

`src/routeTree.gen.ts` is **auto-generated** by TanStack Router — never edit it manually.

The root layout (`__root.tsx`) handles the active session redirect: if a user has an active workout session, it auto-redirects to `/log/$sessionId`.

### Backend (Convex)

`convex/schema.ts` defines all tables. Key tables:

- **`exercises`** — exercise library; default exercises (`isDefault: true`) + user-created; fields: name, muscleGroups, category (`compound`/`isolation`), equipment, notes, userId
- **`workoutSessions`** — session tracking; fields: userId, date, startTime, endTime, name, routineId, status (`active`/`completed`/`cancelled`); indexed by userId+status and userId+date
- **`sets`** — individual set records; fields: sessionId, exerciseId, userId, setNumber, reps, weight, unit (`kg`/`lbs`), RPE, setType (`warmup`/`working`/`drop`/`failure`), loggedAt; indexed by session, exercise, user, and session+exercise
- **`oneRepMaxes`** — 1RM personal bests; fields: exerciseId, userId, value, unit, date, source (`manual`/`calculated`/`actual`), formula
- **`routines`** — preset sequences; fields: userId, name, exercises array (with default sets/reps/weight)

Convex API files:

- `convex/exercises.ts` — list/fetch/create exercises
- `convex/workoutSessions.ts` — start/end/manage sessions
- `convex/sets.ts` — log and manage individual sets
- `convex/oneRepMaxes.ts` — store and retrieve 1RM records
- `convex/routines.ts` — create and manage routines
- `convex/progress.ts` — analytics and progress tracking
- `convex/seed.ts` — seed default exercise data

`convex/_generated/` is **auto-generated** from schema — never edit manually.

### UI Layout

`src/components/AppShell.tsx` wraps all authenticated pages. It renders `Sidebar` on desktop and `BottomTabBar` on mobile. Pages use `pb-16 sm:pb-0` to account for the mobile bottom nav.

Design uses a Spotify-inspired dark theme with green accent (`#1DB954`). CSS custom properties are defined in `src/styles.css`.

Component organization:

```
src/components/
├── AppShell.tsx          # Root layout wrapper
├── Sidebar.tsx           # Desktop navigation
├── BottomTabBar.tsx      # Mobile bottom navigation
├── ActiveSessionBar.tsx  # Active workout session indicator
├── OfflineBanner.tsx     # Offline status indicator
├── Stepper.tsx           # Step indicator UI
├── button.tsx            # Base button component
├── exercises/
│   └── AddExerciseForm.tsx
├── routines/
│   ├── CreateRoutineForm.tsx
│   └── RoutineCard.tsx
├── session/
│   ├── AddExerciseModal.tsx
│   ├── ExerciseSection.tsx
│   ├── SessionSummary.tsx
│   ├── SetCard.tsx
│   └── SetRow.tsx
└── ui/                   # Base UI primitives
```

## Key Conventions

- **Linter/formatter**: Biome (not ESLint/Prettier). Tab indentation, double quotes for JS/TS strings.
- **Styling**: Tailwind CSS v4 + CVA for component variants. No CSS modules. Use `cn()` from `src/lib/utils.ts` to merge class names.
- **Icons**: Lucide React only. Do not add other icon libraries.
- **Path aliases**: `#/*` and `@/*` both resolve to `src/`. `@convex/*` resolves to `convex/`.
- **1RM calculations**: Shared logic in both `src/lib/oneRepMax.ts` (client) and `convex/lib/oneRepMax.ts` (server) using the Epley formula (`weight × (1 + reps/30)`). Keep them in sync — single-rep sets are treated as actual 1RMs. Auto-update behavior (in `convex/sets.ts`): logging a set auto-stores a new 1RM if it beats the existing record; if a manual 1RM exists, auto-calculation is skipped entirely; deleting a set clears all non-manual 1RMs for that exercise and recalculates from remaining sets.
- **Auth guards**: Use Clerk's `<SignedIn>` / `<RedirectToSignIn>` components for protected UI. All Convex functions enforce auth server-side.
- **Biome excludes**: `src/routeTree.gen.ts` and `src/styles.css` are excluded from linting — do not add lint-disable comments in those files.
- **Forms**: Use TanStack Form with Zod schemas for validation.
- **Data fetching**: Use Convex's `useQuery` / `useMutation` hooks for all backend data. The `@convex-dev/react-query` adapter is available for TanStack Query integration.

## Environment Variables

Variable sources differ by context:

- **Local dev** (`npm run dev:all`): vars come from `.env` / `.env.local`
- **Local Workers preview** (`npm run preview`): vars injected by Wrangler from `wrangler.jsonc`
- **Deployed envs**: vars live in `wrangler.jsonc` under `[env.production]`, `[env.dev]`, `[env.stg]`

| Variable                     | Purpose                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk public key for frontend auth                               |
| `VITE_CONVEX_URL`            | Convex deployment URL for the frontend client                    |
| `environment_name`           | Set by Wrangler: `"production"`, `"development"`, or `"staging"` |

The Convex backend reads `CLERK_JWT_ISSUER_DOMAIN` from its own environment (set via `npx convex env set` or the Convex dashboard), configured in `convex/auth.config.ts`.

`CONVEX_DEPLOYMENT` is written to `.env.local` automatically by `npx convex dev`.
