# Workouts (workout tracker)

Personal workout tracker with real-time session logging, exercise library, 1RM tracking, and routine management.

## Tech Stack

- **React 19** + TanStack Start/Router (SSR, file-based routing)
- **Convex** — real-time serverless backend
- **Clerk** + `@appelent/auth` — authentication
- **Cloudflare Workers** — hosting (via Wrangler)
- **Tailwind CSS v4** + CVA for component variants
- **Biome** — linting and formatting
- **Vitest** — tests

## Features

- Active workout session logging (sets, reps, weight, RPE, set type)
- Exercise library — default + user-created, filterable by muscle group and equipment
- Routine builder — preset exercise sequences
- Progress tracking with 1RM history (Epley formula + manual entry)
- Dashboard with session history
- Responsive — sidebar on desktop, bottom tab bar on mobile

## Prerequisites

- Node.js >= 22, [pnpm](https://pnpm.io) >= 11 (this repo uses pnpm — not npm/yarn)
- [Clerk](https://clerk.com) account (auth)
- [Convex](https://convex.dev) account (backend)
- [Cloudflare](https://cloudflare.com) account (hosting, for deploys)
- Read access to the private `@appelent` GitHub Packages scope (ask a maintainer) — required to install `@appelent/auth`

## Setup

```bash
# One-time: authenticate to the private @appelent registry.
# pnpm won't expand env vars from a committed .npmrc, so this goes in your
# user-level ~/.npmrc:
#   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
# and export NODE_AUTH_TOKEN (a GitHub PAT with read:packages) in your shell.

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Fill in VITE_CLERK_PUBLISHABLE_KEY and CONVEX_DEPLOYMENT

# Initialize Convex (first time only — prompts login + writes CONVEX_DEPLOYMENT)
pnpm exec convex dev --once
```

## Development

```bash
pnpm dev:watch   # Convex (watch mode) + Vite, concurrently — recommended, http://localhost:3000
```

`pnpm dev:watch` runs both servers you need for full functionality in one command. `pnpm dev:all` is a lighter alternative that only pushes Convex functions once at startup (fine for a quick session, but Convex won't re-sync if you edit `convex/` afterward). `pnpm dev` starts Vite only.

On the sign-in screen, a "▶ Dev: log in as test user" button appears if `VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` are set (only takes effect against a Clerk *test* key, never production).

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (from Clerk dashboard) |
| `VITE_CONVEX_URL` | Convex deployment URL for the frontend client |
| `CONVEX_DEPLOYMENT` | Convex deployment reference (set automatically by `npx convex dev`) |
| `VITE_TEST_USER_EMAIL` / `VITE_TEST_USER_PASSWORD` | Optional — enables the dev test-login button above |

The Convex backend itself reads `CLERK_JWT_ISSUER_DOMAIN` from its own environment (`pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN <value>`), not from a `.env` file.

## Commands

```bash
pnpm dev:watch    # Convex (watch mode) + Vite, concurrently (recommended)
pnpm build        # Production build
pnpm typecheck    # tsc --noEmit
pnpm test         # Run Vitest tests
pnpm lint         # Biome lint
pnpm format       # Biome format
pnpm check        # Biome lint + format check
pnpm deploy       # Full prod flow: convex deploy + build + Cloudflare deploy
pnpm deploy:dev   # Push Convex dev functions + dev build + deploy to Cloudflare (dev env)
```

## Deployment

Hosted on Cloudflare Workers via Wrangler (see `wrangler.jsonc` for the `production`/`dev` environments). Every pull request also gets an automatic, isolated preview — a fresh per-PR Convex backend plus a per-PR Worker — provisioned by `.github/workflows/preview.yml` and linked in a PR comment.

## Architecture

```
Clerk (auth) → JWT → Convex backend → real-time subscriptions → React components
```

- `src/` — React 19 frontend with TanStack Router file-based routes
- `convex/` — Schema, queries, mutations (serverless)
- `convex/schema.ts` — Source of truth for all tables
- `src/routes/__root.tsx` — Root layout; auto-redirects active sessions to `/log/$sessionId`

## Routes

| Path | Description |
|---|---|
| `/` | Home / landing |
| `/dashboard` | Session history + stats |
| `/log` | Start or resume a workout |
| `/log/$sessionId` | Active session logging |
| `/exercises` | Exercise library |
| `/exercises/$id` | Exercise detail + 1RM history |
| `/routines` | Routine management |
| `/progress` | Progress charts |
| `/profile` | User settings |
