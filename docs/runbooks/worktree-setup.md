---
type: runbook
description: Read when creating a worktree or its isolated Convex deployment.
version: 2.0.0
---

# Worktree setup

Every worktree is prepared by the shared
[workspace script](../standards/workspaces.md). The T3 Code hook in `t3.json` runs it
on worktree creation; other editors and manual worktrees run the same command:

```sh
node scripts/workspace.mjs prepare --editor t3   # or codex, cursor, claude, orca
```

The policy is `workspace` in [`appelent.json`](../../appelent.json): install
dependencies, then write `.env.local` and `apps/mobile/.env.local` from Infisical
`dev` (`env apply local --only file`). Worktrees share the dev deployment
`colorless-sturgeon-704`: runtime writes are visible to every worktree, so use
throwaway accounts for destructive checks. Run `pnpm build:packages` before checks
that need `@foundry/core`'s build.

## Isolated backends

Use your own Convex deployment for schema migrations, seeds, or destructive data work:

```sh
node scripts/workspace.mjs clean   # the hook already prepared this worktree in none mode
node scripts/workspace.mjs prepare --editor t3 --backend cloud --days 5
pnpm seed:reset                    # optional, only on the isolated deployment
```

Cloud mode needs `pnpm exec convex login`. It creates the deployment, applies its
Convex values, mints a deployment-scoped key into `.env.local`, pushes functions
once, and writes the client URLs. `--backend local` selects a local deployment on
this machine instead; keep `pnpm exec convex dev --env-file .env.local` running while
you use it. Restart Metro after the URL changes (`pnpm --dir apps/mobile start --clear`).

Preview without writing anything with `--dry-run`.

## Cleanup

```sh
node scripts/workspace.mjs clean        # before removing the checkout
node scripts/workspace.mjs gc --dry-run # outstanding resources across worktrees
```

Cleanup removes only what the workspace ledger owns: unchanged generated files,
scoped keys, and expired or deleted deployments. Modified files stay.
