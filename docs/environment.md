# Environment contract

[`env.manifest.ts`](../env.manifest.ts) is the source of truth for which
Workouts value each web, mobile, Convex, CI, and workspace consumer reads. The
thin `scripts/env.mjs` wrapper runs the shared `@appelent/dev` environment
engine; it does not contain app routing of its own.

The app has four environments: `local`, per-PR `preview`, stable `dev`, and
`production`. There is no Workouts staging environment. Stable Convex targets
and the preview project come from the existing Wrangler and worktree setup
metadata. The preview Worker remains `workouts-pr-<number>`, the development
Worker remains `workouts-dev`, and production remains `workouts`.

## Source prerequisite

Workouts uses the same Infisical project reference as Gather and keeps its
app-specific values under `/workouts`. Its `local` source is `dev`, both PR
`preview` and stable app `dev` use the project's `staging` source, and
`production` uses `prod`. The app environment remains named `dev`; the
provider's `staging` slug does not introduce a Workouts staging deployment.

The source lookup order is `/` followed by `/workouts`; a value in the app
folder overrides the same source name at the root. Shared values retain
Gather's existing canonical source keys, while each landing keeps the exact
Workouts variable name consumed by code or CI. `.infisical.json` contains only
the nonsecret project reference. Values remain in memory and are written only
to destinations declared by the manifest.

Static commands do not require provider authentication:

```sh
pnpm env:check
pnpm env:generate
```

Provider reads and all writes are explicit future invocations. Inspect the
plan before applying an environment:

```sh
pnpm env:plan preview --pr 123
pnpm env:apply local --only file
```

Do not run a production apply as part of local workspace preparation.

## Generated and app-owned values

The existing workspace setup owns `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, the
optional `CONVEX_SITE_URL`, and any deployment-scoped `CONVEX_DEPLOY_KEY` in
the root `.env.local`. It also copies the selected public URL to
`apps/mobile/.env.local`. Those placements are marked as supplied outputs, so
the environment engine does not replace them with a parent workspace's
selection.

The preview workflow similarly obtains `VITE_CONVEX_URL` from `convex deploy`.
The manifest preserves its existing `PREVIEW_CLERK_PUBLISHABLE_KEY`,
`CONVEX_DEPLOY_KEY`, `NODE_AUTH_TOKEN`, `CLOUDFLARE_API_TOKEN`, and
`CLOUDFLARE_ACCOUNT_ID` names. EAS uses the existing `development`, `preview`,
and `production` environments, and reads `NODE_AUTH_TOKEN` for private package
installation.

The test-user email and password are optional but public client values because
Vite and Metro embed them in bundles. They are deliberately absent from every
production placement and must refer only to a Clerk test instance.

`environment_name` stays a committed Wrangler constant. The legacy example's
`CLERK_SECRET_KEY`, `VITE_CONVEX_SITE_URL`, `REGISTRY_OWNER`, and
`CLOUDFLARE_ENV` names have no current source or workflow consumer and are not
part of the manifest.

Existing human-owned `.env.local` files stay untouched. Before using apply,
review and migrate their values to the canonical source, then adopt the
generated-file ownership separately. Apply never transfers ownership
automatically and refuses to overwrite a file that lacks its generated marker.

## Local ownership metadata

The engine records only app/environment names, destination labels, and variable
names in `.appelent/env-state.json`; it never stores values there. This local
ledger is ignored by Git and lets `--prune` remove only names a prior
successful apply wrote. `.appelent/env.lock/` serializes applies in one
checkout and is also ignored. If an interrupted apply leaves the lock behind,
first establish that no apply is still running, then remove that lock directory
before retrying.
