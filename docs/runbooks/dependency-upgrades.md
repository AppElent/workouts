---
type: runbook
description: Read when upgrading dependencies.
version: 1.1.0
---

# Dependency upgrades

Use the installed `upgrade-deps` skill; if it is unavailable, say so and apply
its constraints by hand. Routine upgrades stay within current majors; report
major migrations for discussion.

Find candidates with `pnpm outdated`. Root changes pass the root gates in
[verification](verification.md). Mobile changes also need the Expo upgrade
guidance, mobile typecheck and Jest, `expo install --check`, an export, and a
compatible native build per [mobile releases](mobile-releases.md).

Report versions, compatibility changes, failures, and untested browser/device paths.

## Dependabot

[`.github/dependabot.yml`](../../.github/dependabot.yml) opens weekly grouped
minor/patch PRs and monthly GitHub Actions PRs; security updates are separate.
It ignores majors, Expo SDK-aligned packages, and patched `convex-helpers`;
upgrade those with the skill above. Its cooldown must stay at or above
`minimumReleaseAge` in `pnpm-workspace.yaml`. Dependabot PRs get no Actions
secrets, so the preview deploy skips them. Review the changelog before merging.
