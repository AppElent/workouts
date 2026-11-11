---
type: runbook
description: Read when deploying Foundry's web app and backend, or changing deploy.yml or the deploy scripts.
version: 1.0.0
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

No seed runs on deploy: fresh databases need no exercise seeding
([exercise migration](exercise-migration.md)).

## Verify

- The Deploy run is green, and `https://foundry-stg.appelent.nl` serves the new build.
- A manual run from a branch other than `main` fails at `Guard production ref`.
- After a production run, the Convex dashboard for `fine-akita-444` shows the new
  functions and `foundry` serves the new build.

## Troubleshooting

- `CONVEX_DEPLOY_KEY … is missing or not a prod: key`: the Environment has no key of
  its own, or inherited a repository-level one. Run `pnpm env:apply <environment> --only github`.
- `Built Worker is foundry, expected foundry-staging`: the build ran without
  `CLOUDFLARE_ENV=staging`.
- Sign-in fails on staging: the production Clerk instance does not accept the origin;
  check the custom domain is live on `foundry-stg.appelent.nl`.
