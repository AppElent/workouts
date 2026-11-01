---
type: runbook
description: Read when refreshing or extending the Foundry Ops dashboard (Sentry, Convex usage, npm updates).
version: 1.0.0
---

# Foundry Ops dashboard

[Foundry Ops](https://claude.ai/artifact/QCDC3mzh57BcJUMSNgfDqr) is a private
Claude dashboard artifact for operating the app. Share it from its Share menu
before sending the link to anyone else. Sentry surfaces and sampling stay in
[Sentry operations](sentry.md); dependency upgrades follow
[dependency upgrades](dependency-upgrades.md).

## Prerequisites

- Convex CLI access to the target deployment (`pnpm exec convex login`, or a
  deploy key in the shell).
- For the Sentry panel: the Sentry connector added in claude.ai under
  Settings → Connectors, signed in to `appelent`.

## Project facts

| Panel | Source | Freshness |
| --- | --- | --- |
| Errors | Sentry connector, project `appelent/foundry`, split by `app` tag | Live per reader, once connected |
| Usage | `monitoring:usageSnapshot` (internal Convex query) | Snapshot |
| Dependencies | `pnpm outdated --recursive` | Snapshot; stale after 14 days |

`monitoring:usageSnapshot` returns records created and distinct active
accounts over the last 1, 7 and 30 days for workout sessions, sets, activities,
WOD results, diary entries, body metrics and hosted workouts. It reads only the
last 30 days through the creation-time index and returns counts, never record
contents or account IDs.

## Steps

1. From the repository root, write a snapshot:

   ```sh
   pnpm monitor:snapshot --prod --out ops-snapshot.json
   ```

   Use `--deployment <name>` for another deployment. Without Convex access the
   script still writes the npm part and reports the skipped usage on stderr.
   Prefer `--out`: pnpm's own pre-run output can land on stdout.
2. Give `ops-snapshot.json` to Claude and ask it to refresh Foundry Ops. Keep
   the file out of git.

## Verify

- The dashboard's Sources list shows the refreshed time on each snapshot.
- The usage figures match `pnpm exec convex run monitoring:usageSnapshot --prod`.

## Troubleshooting

- Usage skipped with `No CONVEX_DEPLOYMENT set`: pass `--prod` or
  `--deployment`, or run `pnpm exec convex dev --once` to configure the
  worktree.
- Convex reports too many documents read: the 30-day window outgrew one
  query's read limit. Move the counting to an action that pages per table.
