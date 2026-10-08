# Workouts (workout tracker)

Personal workout tracker with real-time session logging, exercise library, 1RM tracking, and routine management.

## Project guidance

The web uses TanStack Start; the Foundry mobile app uses Expo. Both share a Convex
backend and Clerk authentication. Use [coding standards](CODING_STANDARDS.md) for integration boundaries and
[design standards](DESIGN_SYSTEM.md) for visual and interaction decisions.
The [docs index](docs/README.md) separates current contracts and runbooks from
historical proposals and verification records.

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
- Read access to the private `@appelent` GitHub Packages scope (ask a maintainer) — required to install `@appelent/auth` and `@appelent/cli`

## Setup

```bash
# One-time: authenticate to the private @appelent registry.
# pnpm won't expand env vars from a committed .npmrc, so this goes in your
# user-level ~/.npmrc:
#   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
# and export NODE_AUTH_TOKEN (a GitHub PAT with read:packages) in your shell.

# Install dependencies
pnpm install

# Check the manifest, then read the configured Infisical source and apply local values
pnpm env:check
pnpm env:plan local --only file
pnpm env:apply local --only file

# Initialize Convex (first time only — prompts login + writes CONVEX_DEPLOYMENT)
pnpm exec convex dev --once
```

## Development

Concurrent editor/agent worktrees must use the repository's isolated [worktree setup](docs/runbooks/worktree-setup.md) instead of sharing a Convex development deployment.

```bash
pnpm dev:watch   # Convex (watch mode) + Vite, concurrently — recommended, http://localhost:3000
```

`pnpm dev:watch` runs both servers you need for full functionality in one command. `pnpm dev:all` is a lighter alternative that only pushes Convex functions once at startup (fine for a quick session, but Convex won't re-sync if you edit `convex/` afterward). `pnpm dev` starts Vite only.

The current test-login shortcut uses a Clerk test key and optional public client
variables. Follow the [environment contract](docs/runbooks/environment.md); a test key
alone does not establish which backend or deployment is being tested.

## Environment and commands

[Environment routing](docs/runbooks/environment.md) owns source setup and generated
file ownership. `.env.example` catalogs source keys; it is not a template for
`.env.local`. Existing human-owned environment files need explicit adoption.

Use `pnpm run` and the target package manifest for commands. Required checks and
non-obvious target boundaries are in [verification](docs/runbooks/verification.md).

## CLI

Use the CLI locally from this repo:

```bash
pnpm workouts --help
pnpm workouts config get
pnpm workouts config set api-url http://localhost:3000
pnpm workouts auth status
pnpm workouts auth login
```

`auth login` uses the browser login flow from `@appelent/cli`; `auth login --token <token>` is the manual fallback. You do not need to publish this app to use the repo-local CLI. Generic CLI behavior currently comes from `@appelent/cli`. The new
[app-owned CLI guide](docs/features/app-cli/FEATURE.md) describes a future
migration; do not remove the package until imports and login behavior are verified.

## Deployment

Hosted on Cloudflare Workers via Wrangler (see `wrangler.jsonc` for the `production`/`dev` environments). Every pull request also gets an automatic, isolated preview — a fresh per-PR Convex backend plus a per-PR Worker — provisioned by `.github/workflows/preview.yml` and linked in a PR comment.

## Architecture and mobile

See [coding standards](CODING_STANDARDS.md) for workspace boundaries and
[CONTEXT.md](CONTEXT.md) for product vocabulary. Routes come from `src/routes/`
and `apps/mobile/app/`; `src/components/navItems.ts` owns web navigation.
Do not use a copied route inventory as the source of truth.

Mobile development, signing, TestFlight, and OTA procedures are in
[mobile releases](docs/runbooks/mobile-releases.md). CI runs root and mobile checks;
root Vitest/typechecking alone does not cover the Expo target.
