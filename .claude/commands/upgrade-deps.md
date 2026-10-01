---
description: Upgrade Workouts dependencies using the shared upgrade-deps workflow and project checks.
allowed-tools: Bash(pnpm:*), Bash(git:*), Read, Edit
---

Read project coding standards, package/lockfiles, and working-tree state. Invoke
the installed `upgrade-deps` skill for the general compatibility, release-note,
and failure-handling workflow. If unavailable, report it and use those same
constraints explicitly: pnpm only, preserve supply-chain controls, keep coupled
framework packages compatible, and stop/report changes that cannot pass cleanly.
Never weaken or skip tests, force peers, or suppress diagnostics to make an upgrade pass.

For this project, use `pnpm outdated` and the root checks:

```sh
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

For mobile dependency changes also use the Expo overview/upgrade guidance and run
mobile typecheck/Jest, SDK dependency checks, export, and compatible native-build
verification. Follow `docs/mobile-releases.md`; root checks do not verify mobile.

Routine unspecified upgrades stay within current majors. Report deferred major
migrations for discussion. Commit/push only when requested by the invoked user
workflow, after the applicable checks pass; preserve unrelated changes. Report
versions, compatibility changes, failures, and browser/device verification limits.
