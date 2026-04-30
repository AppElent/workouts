# Workouts

Personal workout tracker with real-time session logging, exercise library, 1RM tracking, and routine management.

## Tech Stack

- **React 19** + TanStack Router (file-based routing)
- **Convex** — real-time serverless backend
- **Clerk** — authentication
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

- Node.js
- [Clerk](https://clerk.com) account (auth)
- [Convex](https://convex.dev) account (backend)

## Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Fill in VITE_CLERK_PUBLISHABLE_KEY and CONVEX_DEPLOYMENT

# Initialize Convex (first time only — prompts login + writes CONVEX_DEPLOYMENT)
npx convex dev
```

## Development

Both servers must be running for full functionality.

```bash
# Terminal 1 — Convex backend
npx convex dev

# Terminal 2 — Vite frontend
npm run dev      # http://localhost:3000
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (from Clerk dashboard) |
| `CONVEX_DEPLOYMENT` | Convex deployment URL (set automatically by `npx convex dev`) |

## Commands

```bash
npm run dev      # Start Vite dev server (port 3000)
npm run build    # Production build
npm run test     # Run Vitest tests
npm run lint     # Biome lint
npm run format   # Biome format
npm run check    # Biome lint + format check
```

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
