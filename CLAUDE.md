# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Model routing

- Architecture, debugging, security review: Opus
- Implementation, content, standard coding: Sonnet
- File search, formatting, renaming, exploration: Haiku
- Always escalate security-sensitive changes to Opus for review

## Commands

This repo uses **pnpm** (see `packageManager` in `package.json`). Use `pnpm`, not `npm`/`npx`.

```bash
pnpm dev:watch  # Convex dev server (watch mode) + Vite, concurrently (recommended)
pnpm dev:all    # Push Convex functions once, then start Vite — Convex won't re-sync after that
pnpm dev        # Start Vite dev server only (port 3000, all interfaces)
pnpm build      # Production build (Vite)
pnpm build:development  # Vite build with --mode development
pnpm preview    # Build (dev mode) + start local Cloudflare Workers dev server
pnpm typecheck  # tsc --noEmit
pnpm test       # Run all tests with Vitest
pnpm lint       # Biome linter
pnpm lint:fix   # Biome lint + format, auto-fix (biome check --write)
pnpm format     # Biome formatter
pnpm check      # Biome lint + format check combined
pnpm workouts   # Run the repo-local Workouts CLI
pnpm cli:smoke  # Smoke-test the CLI wrapper
pnpm seed:exercises  # Seed the default exercise library (idempotent)
pnpm seed:wods       # Seed the default benchmark WODs (idempotent)
pnpm seed:test        # Seed demo workout history for the fixed test user
pnpm seed:clear        # Clear the fixed test user's workout history
pnpm seed:reset         # exercises + wods + clear + test, in order
pnpm deploy           # Full prod flow: convex deploy + build + Cloudflare deploy
pnpm deploy:dev       # Push Convex dev functions + dev build + deploy to Cloudflare (dev env)
pnpm cf-typegen       # Generate Cloudflare Workers TypeScript types
```

To run a single test file: `pnpm exec vitest run src/path/to/test.ts`

**Install note**: `pnpm install` needs auth for the private `@appelent` scope. The token is **not** in the committed `.npmrc` (pnpm refuses to expand env vars there); put `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` in your user-level `~/.npmrc` and export `NODE_AUTH_TOKEN`.

**Supply-chain settings** live in `pnpm-workspace.yaml`: a build-script allowlist (`onlyBuiltDependencies`), a publish cooldown (`minimumReleaseAge`), and `overrides` for security pins. See the comments there before changing dependencies.

**Development note**: `pnpm dev:watch` is the recommended way to start development — it runs `convex dev` (continuous, re-pushing on every change) and `vite dev` concurrently via `concurrently`. Both must be running for full functionality; Convex won't be available with `pnpm dev` alone. `pnpm dev:all` only pushes Convex functions once at startup — use it for a quick one-off session, not while actively editing `convex/`.

**Preview note**: `pnpm preview` does a full `build:development` then launches a local Cloudflare Workers dev server via `wrangler dev`. It is not a quick Vite preview — it simulates the production Workers runtime locally. Environment variables are injected by Wrangler from `wrangler.jsonc`.

**CI**: `.github/workflows/ci.yml` runs `check`/`typecheck`/`test`/`build` on every push to `main` and every PR — the only automated guard, since most commits land on `main` directly. `.github/workflows/preview.yml` provisions per-PR Convex + Cloudflare Worker previews; `.github/workflows/cli.yml` smoke-tests the CLI wrapper.

**Claude Code workflow layer**: `.claude/skills/review-app`, `.claude/skills/review-session`, `.claude/commands/upgrade-deps.md`, and `.claude/commands/review-session.md` are project-local copies of the global `~/.claude/skills/custom-review-app` / `custom-review-session` / `~/.claude/commands/custom-upgrade-deps.md` / `custom-review-session.md` templates (renamed to avoid the duplicate-skill collision). The global copies are the source of truth — port non-project-specific fixes back there rather than letting the copies drift. `.claude/skills/verify/SKILL.md` is the one exception: it's project-specific by design (route→module map) and has no global counterpart.

## Architecture

Single codebase split into two layers:

- **`src/`** — React 19 frontend with TanStack React Start (SSR, file-based routing via TanStack Router)
- **`convex/`** — Serverless backend: database schema, queries, mutations, actions

The app is server-side rendered via TanStack React Start and deployed as a Cloudflare Worker. The server entry point is `@tanstack/react-start/server-entry`. Deployment environments (production, dev) are defined in `wrangler.jsonc`. PR previews are provisioned per-PR by `.github/workflows/preview.yml` (per-PR Convex backend + per-PR Worker named `workouts-pr-<N>`).

### Tech Stack

| Layer            | Technology                                        |
| ---------------- | ------------------------------------------------- |
| UI Framework     | React 19 + TanStack React Start (SSR)             |
| Routing          | TanStack Router (file-based, part of React Start) |
| Hosting          | Cloudflare Workers (via Wrangler)                 |
| Backend          | Convex (serverless, real-time)                    |
| Auth             | Clerk (+ `@appelent/auth`, shared internal glue)  |
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
- `convex/seed.ts` — seed default exercise data and benchmark WODs (`seedExercises`, `seedWods`; `seedTestData`/`clearUserData` are internal, demo-data only)

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
- **UI hygiene**: Shared mechanisms live in `src/components/ui/` — `useToast()` (toast.tsx), `useConfirm()` (confirm-dialog.tsx), `Skeleton`, `EmptyState` — plus `RouteErrorFallback` as the router's `defaultErrorComponent` and `Button`'s `loading` prop. The rules for when to use them are in the managed block's "UI hygiene" checklist at the end of this file (baseline step 16).
- **Path aliases**: `#/*` and `@/*` both resolve to `src/`. `@convex/*` resolves to `convex/`.
- **1RM calculations**: Shared logic in both `src/lib/oneRepMax.ts` (client) and `convex/lib/oneRepMax.ts` (server) using the Epley formula (`weight × (1 + reps/30)`). Keep them in sync — single-rep sets are treated as actual 1RMs. Auto-update behavior (in `convex/sets.ts`): logging a set auto-stores a new 1RM if it beats the existing record; if a manual 1RM exists, auto-calculation is skipped entirely; deleting a set clears all non-manual 1RMs for that exercise and recalculates from remaining sets.
- **Auth guards**: Use Clerk's `<SignedIn>` / `<RedirectToSignIn>` components for protected UI. All Convex functions enforce auth server-side.
- **Dev test login**: `@appelent/auth` renders a "▶ Dev: log in as test user" button on the sign-in screen whenever `VITE_CLERK_PUBLISHABLE_KEY` is a Clerk *test* key (`pk_test_...`) and `VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` are set — both conditions must hold, so it's structurally impossible on production (`pk_live_...`). Use it to authenticate when testing auth-gated pages locally or on a non-prod preview.
- **Biome excludes**: `src/routeTree.gen.ts` and `src/styles.css` are excluded from linting — do not add lint-disable comments in those files.
- **Forms**: Use TanStack Form with Zod schemas for validation.
- **Data fetching**: Use Convex's `useQuery` / `useMutation` hooks for all backend data. The `@convex-dev/react-query` adapter is available for TanStack Query integration.
- **CLI**: The `pnpm workouts` command runs [cli/index.ts](cli/index.ts), a thin wrapper around the shared `@appelent/cli` package (`createCli({ appName: "workouts" })`). Generic `auth`/`config` commands live in the package — do **not** re-implement or fork them here. App-specific domain commands (e.g. a future `exercise`/`workout list`) belong in this repo, registered via the package's `commands: CliCommand[]` option so each hits this app's own Convex functions/API. Use `pnpm cli:smoke` to verify the wrapper in CI/local checks. You do not need to publish this app to use the repo-local CLI; publish `@appelent/cli` only when changing shared CLI behavior, then bump the consuming app dependency. See the package README (`@appelent/cli`) for the API and the `add-cli` skill for the integration pattern.

## Environment Variables

Variable sources differ by context:

- **Local dev** (`pnpm dev:watch`/`dev:all`): vars come from `.env` / `.env.local`
- **Local Workers preview** (`pnpm preview`): vars injected by Wrangler from `wrangler.jsonc`
- **Deployed envs**: vars live in `wrangler.jsonc` under top-level (production) and `[env.dev]`. PR previews get `VITE_CONVEX_URL` from the Convex CLI per-PR and `VITE_CLERK_PUBLISHABLE_KEY` from the `PREVIEW_CLERK_PUBLISHABLE_KEY` GitHub secret.

| Variable                     | Purpose                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk public key for frontend auth                               |
| `VITE_CONVEX_URL`            | Convex deployment URL for the frontend client                    |
| `environment_name`           | Set by Wrangler: `"production"`, `"development"`, or `"preview"` (PR previews) |
| `VITE_TEST_USER_EMAIL` / `VITE_TEST_USER_PASSWORD` | Enable `@appelent/auth`'s dev test-login button (see Key Conventions) — only takes effect on a Clerk test key |

The Convex backend reads `CLERK_JWT_ISSUER_DOMAIN` from its own environment (set via `npx convex env set` or the Convex dashboard), configured in `convex/auth.config.ts`.

`CONVEX_DEPLOYMENT` is written to `.env.local` automatically by `npx convex dev`.

<!-- appelent-managed:start -->
## Appelent Managed Project

This is an Appelent-managed app. Opted-in features and their options are
recorded in `appelent.json`. Feature definitions live in the `appelent`
plugin (locally installed) or https://github.com/AppElent/appelent-packages
(`skills/<feature>/FEATURE.md`).

Before adding functionality that could apply to multiple apps, check the
feature catalog first. To add or update a feature, use `/appelent`.

### UI hygiene

- Async views render a skeleton (`ui/skeleton.tsx`) matching the final
  layout — never a blank page or a spinner-only screen.
- Destructive actions go through `useConfirm()` (`ui/confirm-dialog.tsx`) —
  never `window.confirm`. Confirm buttons use verb-specific labels
  ("Delete workout", not "OK").
- Mutations: the trigger button shows a pending state (`Button loading`);
  errors always surface an error toast (`useToast().error`); success toasts
  only when the result isn't already visible on screen. Forms keep the
  user's input on failure.
- List/dashboard views define an `EmptyState` (`ui/empty-state.tsx`) —
  never an unexplained blank region.
- Every route defines a document title (route `head`); route errors render
  the shared error fallback with retry, not a white screen.
- Icon-only buttons get an `aria-label`. Dialogs/popovers use Base UI
  primitives only.
<!-- appelent-managed:end -->
