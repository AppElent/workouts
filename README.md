# Workouts

Personal training and nutrition tracker: real-time strength session logging,
exercise library, routines, 1RM tracking, runs and rides, and a nutrition diary.

The web app (TanStack Start) and the Foundry mobile app (Expo) share a Convex
backend and Clerk authentication. Documentation is mapped in [docs/](docs/README.md).

## Prerequisites

- Node.js >= 22 and [pnpm](https://pnpm.io) >= 11
- [Clerk](https://clerk.com), [Convex](https://convex.dev), and, for deploys,
  [Cloudflare](https://cloudflare.com) accounts
- Read access to the private `@appelent` GitHub Packages scope (ask a maintainer)

## Setup

```bash
# One-time, in your user-level ~/.npmrc (pnpm does not expand env vars from a
# committed .npmrc), with NODE_AUTH_TOKEN a GitHub PAT with read:packages:
#   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}

pnpm install

# Read the configured Infisical source and apply local values
pnpm env:check
pnpm env:plan local --only file
pnpm env:apply local --only file

# First time only: log in to Convex and write CONVEX_DEPLOYMENT
pnpm exec convex dev --once
```

`.env.example` catalogs source keys; it is not a template for `.env.local`. See
[environment routing](docs/runbooks/environment.md) for sources and file ownership.

## Development

```bash
pnpm dev:watch   # Convex (watch) + Vite on http://localhost:3000
```

Each concurrent worktree needs its own Convex deployment: use
[worktree setup](docs/runbooks/worktree-setup.md). Checks and the other dev
scripts are in [verification](docs/runbooks/verification.md); mobile builds,
TestFlight, and OTA updates are in [mobile releases](docs/runbooks/mobile-releases.md).

## CLI

```bash
pnpm workouts --help
pnpm workouts config set api-url http://localhost:3000
pnpm workouts auth login            # browser flow; --token <token> as fallback
```

## Deployment

Cloudflare Workers via Wrangler (`wrangler.jsonc` defines `production` and `dev`).
Every pull request gets an isolated preview (per-PR Convex backend and Worker)
from `.github/workflows/preview.yml`, linked in a PR comment.
