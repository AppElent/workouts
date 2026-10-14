---
type: runbook
description: Read when running checks, dev servers, or test login for Foundry.
version: 2.0.0
---

# Verify Foundry

Binds the shared [verification contract](../standards/verification.md)
to Foundry targets and credentials.

## Checks

From the repository root, run the applicable gates:

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @foundry/mobile typecheck
pnpm --filter @foundry/mobile test --runInBand
```

Root types/Vitest exclude mobile; mobile uses Jest. Build `@foundry/core` first
when its output is missing: `pnpm --filter @foundry/core build`.

## Backend and login

Runtime checks use the shared dev deployment unless the user asks for
[isolated worktree setup](worktree-setup.md). Confirm backend identity before
runtime writes: localhost and EAS profile names do not establish it.
The web test-login shortcut needs a Clerk test key and configured public test-user
variables. Use the documented test account on the verified target. Inspect variable
names without printing credentials. Missing credentials limit acceptance.

## Web

`pnpm dev:watch` runs Vite with continuous Convex sync. `pnpm dev` starts only
Vite; `pnpm dev:all` pushes once. `pnpm preview` builds development mode and runs
Wrangler. Routes are in `src/routes/`; navigation comes from
`src/components/navItems.ts` and backend ownership from the called Convex module.

## Mobile

Use [mobile releases](mobile-releases.md) for a compatible development client and
Metro. Select a free port, then confirm this checkout's bundle and backend. Expo Go
does not supply this app's custom native modules. Use host device tools when
available; Device Hub is the local dashboard fallback.

Exercise English/Dutch, supported themes, Dynamic Type XL, native navigation,
keyboard/dismissal, safe areas, and affected gestures. For nutrition persistence
changes, verify readable cached history and an explicit unavailable-day state.
Physical haptics remain a device check.

Report results in the PR. Write a record under `docs/records/` only when a contract
or ADR cites the evidence; pending acceptance becomes a GitHub issue.
The [iOS checklist](ios-acceptance.md) supplements affected
flow checks; its unchecked rows remain pending.
