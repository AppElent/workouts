# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server on port 3000
npm run build      # Production build
npm run test       # Run tests with Vitest
npm run lint       # Biome linter
npm run format     # Biome formatter
npm run check      # Biome lint + format check
```

To run a single test file: `npx vitest run src/path/to/test.ts`

Convex runs its own local dev server alongside Vite. Both must be running for full functionality.

## Architecture

Single codebase split into two layers:

- **`src/`** — React 19 frontend with TanStack Router (file-based routing)
- **`convex/`** — Serverless backend: database schema, queries, mutations

### Data flow

```
Clerk (auth) → JWT → Convex backend → real-time subscriptions → React components
```

All Convex functions require auth. The Convex client is initialized in `src/integrations/convex/` and authenticated via Clerk's JWT token (`convex/auth.config.ts`).

### Routing

Routes live in `src/routes/` and use TanStack Router's file-based convention. `src/routeTree.gen.ts` is auto-generated — never edit it manually. The root layout (`src/routes/__root.tsx`) handles the active session redirect: if a user has an active workout session, it auto-redirects to `/log/$sessionId`.

### Backend (Convex)

`convex/schema.ts` defines all tables. Key tables:

- `exercises` — exercise library (default + user-created)
- `workoutSessions` — sessions indexed by `userId + status`
- `sets` — individual sets with weight, reps, RPE, set type
- `oneRepMaxes` — personal bests (calculated via Epley formula or manual)
- `routines` — preset exercise sequences

`convex/_generated/` is auto-generated from schema — never edit manually.

### UI Layout

`AppShell.tsx` wraps all pages. It renders `Sidebar` on desktop and `BottomTabBar` on mobile. Pages use `pb-16 sm:pb-0` to account for the mobile bottom nav.

Design uses a Spotify-inspired dark theme with green accent (`#1DB954`). CSS custom properties are defined in `src/styles.css`.

## Key Conventions

- **Linter/formatter**: Biome (not ESLint/Prettier). Tab indentation, double quotes.
- **Styling**: Tailwind CSS v4 + CVA for component variants. No CSS modules.
- **Icons**: Lucide React only.
- **Path aliases**: `#/*` and `@/*` both resolve to `src/`. `@convex` resolves to `convex/`.
- **1RM calculations**: Shared logic exists in both `src/lib/oneRepMax.ts` (client) and `convex/lib/oneRepMax.ts` (server). Keep them in sync.
- **Auth guards**: Use Clerk's `<SignedIn>` / `<RedirectToSignIn>` components for protected UI.

## Environment Variables

Required in `.env`:
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk public key
- `CONVEX_DEPLOYMENT` — Convex deployment URL
