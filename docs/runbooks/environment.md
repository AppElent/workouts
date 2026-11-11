---
type: runbook
description: Read when changing environment variables, Infisical sources, or generated env files.
version: 3.0.0
---

# Environment contract

[`env.manifest.ts`](../../env.manifest.ts) is data only: it names each Foundry value,
its Infisical key, and which consumer reads it in which environment. The
`pnpm env:*` scripts run `scripts/env.mjs`, which routes every landing with the
[shared model](../standards/environments.md). Foundry records no routing exception.

## Environments

| Environment | What it is | Infisical | Convex | Worker | GitHub | EAS |
| --- | --- | --- | --- | --- | --- | --- |
| `local` | Your machine and every worktree | `dev` | `colorless-sturgeon-704` | — | — | `development` |
| `dev` | Shared deployed development backend | `dev` | `colorless-sturgeon-704` | `foundry-dev` | Environment `dev` | `development` |
| `preview` | Short-lived web PR previews | `staging` | per-PR preview | `foundry-pr-<n>` | repository, `PREVIEW_<name>` | — |
| `staging` | Staging web (deployed on merge) and the installed preview app | `prod` | `fearless-mouse-671` (web only) | `foundry-staging` | Environment `staging` | `preview` |
| `production` | Production | `prod` | `fine-akita-444` | `foundry` | Environment `production` | `production` |

Auth follows the Infisical tier. `local`, `dev`, and web PR previews use the Clerk
development instance: Infisical `staging` holds `clerk-publishable-key` and
`clerk-jwt-issuer-domain` as secret references to the `dev` values. Staging web, the
installed EAS preview app, and `production` read Infisical `prod` and use the
production instance.

Foundry's `staging` environment is two things that share Infisical `prod`: the staging
web, which [deploy](deploy.md) ships on every merge to `main` with its own Convex
deployment, and the installed preview app in EAS `preview`, which stays on the
production backend. The staging web's deploy key is `convex-staging-deploy-key`, so it
never shares production's.

Infisical folders are read in the order `/`, then `/foundry`; a value in the app
folder wins. `.infisical.json` holds only the project reference.

## Commands

Static commands need no provider login:

```sh
pnpm env:check
pnpm env:generate   # rewrites .env.example; never edit it by hand
```

Provider reads and writes show names and destinations only. Plan before applying:

```sh
pnpm env:plan <environment>          # preview: add --pr <n> for the Worker
pnpm env:apply local --only file     # .env.local and apps/mobile/.env.local
pnpm env:apply preview --only github # repository PREVIEW_<name> values
pnpm env:apply staging --only eas    # EAS preview: the installed preview app
```

New worktrees get local files from `node scripts/workspace.mjs prepare`
([worktree setup](worktree-setup.md)), never by copying another checkout's files.

## Deploys and OTA updates

Deployed environments never read a `.env.<environment>.local` file. Local deploys
and OTA publishes run through `env:exec`, which adds the environment's values to
one command without writing them:

```sh
pnpm deploy:dev          # exec dev: convex dev --once, CLOUDFLARE_ENV=dev build, wrangler deploy
pnpm deploy:staging      # exec staging: convex deploy, CLOUDFLARE_ENV=staging build, wrangler deploy
pnpm deploy:production   # exec production: convex deploy, build, wrangler deploy
pnpm mobile:update:preview   # exec staging: preview channel, EAS preview values
```

`deploy:dev` pushes Convex functions to the deployment in `.env.local`
(`colorless-sturgeon-704` unless the worktree has its own backend).
`deploy:production` targets Convex with the production `CONVEX_DEPLOY_KEY` from
Infisical `prod`, which wins over any selector or worktree key in `.env.local`, and
deploys the Worker with the `CLOUDFLARE_API_TOKEN` from the GitHub Environment's
values. Staging, production, and the preview workflow get `VITE_CONVEX_URL` from
`convex deploy`. A merge to `main` deploys staging from CI ([deploy](deploy.md)).

## Notes

- Test-user values land only in `local` and `dev`. They are public client values on
  the Clerk development instance.
- `environment_name` is a committed Wrangler var per Wrangler environment
  (`production`, `staging`, `development`, `preview`). `vite.config.ts` reads it
  for the `CLOUDFLARE_ENV` being built and bakes it into the browser and Worker
  bundles as the Sentry environment; no manifest value reaches the Worker at runtime.
- `.appelent/env-state.json` records only names a previous apply wrote, so `--prune`
  removes only those. `.appelent/env.lock/` serializes applies. Both are ignored by
  Git. If an interrupted apply leaves the lock, confirm no apply is running before
  removing it.
