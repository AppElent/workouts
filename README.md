# Foundry

Personal training and nutrition tracker: real-time strength session logging,
exercise library, routines, 1RM tracking, runs and rides, and a nutrition diary.

The web app (TanStack Start) and the Foundry mobile app (Expo) share a Convex
backend and Clerk authentication. Documentation is mapped in [docs/](docs/README.md).

## Prerequisites

- Node.js >= 22 and [pnpm](https://pnpm.io) >= 11
- [Clerk](https://clerk.com), [Convex](https://convex.dev), and, for deploys,
  [Cloudflare](https://cloudflare.com) accounts

## Setup

```bash
# Install, then write .env.local and apps/mobile/.env.local from Infisical dev
node scripts/workspace.mjs prepare
```

`.env.example` catalogs source keys; it is not a template for `.env.local`. See
[environment routing](docs/runbooks/environment.md) for sources and file ownership.

## Development

```bash
pnpm dev:watch   # Convex (watch) + Vite on http://localhost:3000
```

Worktrees share the dev Convex deployment; create an isolated one with
[worktree setup](docs/runbooks/worktree-setup.md). Checks and the other dev
scripts are in [verification](docs/runbooks/verification.md); mobile builds,
TestFlight, and OTA updates are in [mobile releases](docs/runbooks/mobile-releases.md).

## Deployment

Cloudflare Workers via Wrangler (`wrangler.jsonc` defines production, `staging`,
`dev`, and the route-free `pr` env). A merge to `main` deploys staging
(`foundry-stg.appelent.nl`); production deploys from **Actions → Deploy → Run
workflow** on `main` ([deploy](docs/runbooks/deploy.md)). `pnpm deploy:staging` and
`pnpm deploy:production` run the same steps from your machine with values from
Infisical ([environment](docs/runbooks/environment.md)).
Add the `preview:web` label to a pull request for an isolated preview (per-PR
Convex backend and Worker) from `.github/workflows/preview.yml`, linked in a PR
comment. Removing the label or closing the PR deletes the Worker. Native builds
are opt-in too: see [CI builds](docs/runbooks/mobile-releases.md#ci-builds).
