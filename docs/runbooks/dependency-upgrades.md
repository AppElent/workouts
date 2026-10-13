---
type: runbook
description: Read when upgrading dependencies.
version: 1.0.0
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
