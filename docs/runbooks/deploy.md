---
type: runbook
description: Read when deploying Foundry's web app and backend, or changing deploy.yml or the deploy scripts.
version: 1.1.0
---

# Deploy

Foundry follows the [deployments standard](../standards/deployments.md): a merge to
`main` deploys staging, and production deploys only from a manual run on `main`.
Environment values and their routing are in [environment](environment.md); PR
previews are in `.github/workflows/preview.yml`.

## Project facts

| Fact | Value |
| --- | --- |
| Workflow | `.github/workflows/deploy.yml`: push to `main` → `staging`; **Actions → Deploy → Run workflow** on `main` → `production` (the job refuses another ref) |
| Checks | The `checks` job calls `ci.yml` through `workflow_call`, the same suite as pull requests. It gets no secrets, so its build uploads no source maps |
| Workers (`wrangler.jsonc`) | `foundry` (production), `foundry-staging` (Wrangler env `staging`, custom domain `foundry-stg.appelent.nl`), `foundry-dev` (manual `deploy:dev` only), `foundry-pr-<n>` (Wrangler env `pr`) |
| Convex | Production: `fine-akita-444`. Staging: `fearless-mouse-671` (prod-type deployment `staging` in the same project), picked by its `prod:` key, `convex-staging-deploy-key` in Infisical `prod` |
| Auth | Staging uses the production Clerk instance (Infisical `prod`), which accepts only `appelent.nl` hosts, so staging needs its custom domain rather than `workers.dev` |
| Credentials | GitHub Environments `staging` and `production`, written by `pnpm env:apply <environment> --only github`. The `Check environment` step checks the `prod:` key prefix and every GitHub-routed name before anything ships |
| Build | Both targets run `pnpm build:packages`, then `convex deploy --cmd` with `pnpm build`. `CLOUDFLARE_ENV` (`staging`, or empty for production) picks the Worker at build time; the `Guard Worker name` step compares `dist/server/wrangler.json` with the expected Worker |
| Sentry | The client reads `VITE_SENTRY_ENVIRONMENT` (`staging` or `production`); the Worker reads its Wrangler var `environment_name` |
| Mobile | The installed preview app (EAS `preview`) stays on the production backend; staging web does not change what it sees |
| By hand | `pnpm deploy:staging` / `pnpm deploy:production` run the same steps through `env.mjs exec <environment> --only github`, with the values read from Infisical |

No seed runs on deploy: fresh databases need no exercise seeding.

## Production Convex drift

Production deploys only when someone runs it, so a merged Convex change can wait
while installed apps already call it (on 12 Nov 2026 food logging in TestFlight
build 27 failed against a production deployment 11 commits behind `main`).
[`scripts/convex-drift.mjs`](../../scripts/convex-drift.mjs) finds the commit of the
last successful GitHub deployment to the `production` Environment and lists the
commits after it that change `convex/` or `packages/core/` (tests excluded;
lockfile-only dependency bumps are not counted). It reads deployment records only, never production secrets.

| Where | What happens |
| --- | --- |
| `.github/workflows/convex-drift.yml` | Runs after every Deploy run and daily at 07:00 UTC. Undeployed Convex commits younger than 24 hours raise a warning; older ones fail the run, and GitHub emails the failed scheduled run |
| `pnpm convex:drift` | The same check from a checkout (needs `gh auth login`); `--target <ref>` compares another ref, `--deployed <sha>` a given commit |
| Mobile release scripts | Refuse to build or publish when this checkout has Convex changes production lacks; see [mobile releases](mobile-releases.md#production-convex-first) |

When it flags drift, run **Actions → Deploy → Run workflow** on `main`. The check
never deploys; the manual gate stays. A `pnpm deploy:production` run from a laptop
records no GitHub deployment, so the check keeps reporting drift until the next
workflow run.

## Shared dev deployment

`colorless-sturgeon-704` is shared by every worktree in the default `none` backend
mode, and any `convex dev --once` from a branch overwrites it with that branch's
functions. Nothing pushes it from `main` automatically: that would need a dev deploy
key in GitHub, and the next branch push would undo it anyway.

The person who merges a pull request that touches Convex (Eric) pushes `main` to it
afterwards, from an up-to-date `main` checkout:

```sh
pnpm build:packages && pnpm exec convex dev --once   # or pnpm deploy:dev to refresh foundry-dev too
```

Work that pushes a branch's functions to shared dev puts `main` back when it is done,
or uses an [isolated backend](worktree-setup.md#isolated-backends) instead.

## Verify

- The Deploy run is green, and `https://foundry-stg.appelent.nl` serves the new build.
- A manual run from a branch other than `main` fails at `Guard production ref`.
- After a production run, the Convex dashboard for `fine-akita-444` shows the new
  functions and `foundry` serves the new build, and the next Convex drift run is
  green.

## Troubleshooting

- `Production Convex lacks … Convex commit(s)`: run the production Deploy on `main`.
  `Could not compare production Convex`: `gh` is not signed in, or has no
  `deployments: read` on the repository. A production run whose Worker step failed
  counts as not deployed even if its Convex step succeeded; the next green run clears it.
- `CONVEX_DEPLOY_KEY … is missing or not a prod: key`: the Environment has no key of
  its own, or inherited a repository-level one. Run `pnpm env:apply <environment> --only github`.
- `Built Worker is foundry, expected foundry-staging`: the build ran without
  `CLOUDFLARE_ENV=staging`.
- Sign-in fails on staging: the production Clerk instance does not accept the origin;
  check the custom domain is live on `foundry-stg.appelent.nl`.
