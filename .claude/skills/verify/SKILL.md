---
name: verify
description: Verify Workouts changes through the affected web/mobile target and report actual runtime coverage.
---

# Verify Workouts

Read root coding/design standards and [the docs index](../../../docs/README.md).
Shared guidelines own generic verification rules. This file owns project commands,
backend selection, test-account behavior, and the route/module starting points.
Documentation-only changes need link/ownership checks, not an invented device pass.

## Backend and login

Use [isolated worktree setup](../../../docs/runbooks/worktree-setup.md) for concurrent
worktrees. Confirm the selected backend before runtime writes; localhost and EAS
profile names do not prove an isolated development deployment.

The web currently exposes a test-login shortcut through `@appelent/auth` when a
Clerk test key and the configured public test-user variables are present. Use only
the documented test account against the verified target. Read configuration names
without printing credential values. Missing credentials are a verification limit,
not a reason to invent accounts or promote this mechanism into shared policy.

## Automated checks

Run applicable project checks from the repository root:

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @workouts/mobile typecheck
pnpm --filter @workouts/mobile test --runInBand
```

Root Vitest/types exclude the mobile target. Mobile uses Jest. Build
`@workouts/core` before dependent checks if its output is missing:
`pnpm --filter @workouts/core build`.
For an initial focused investigation run the affected suite; complete the relevant
required gates before reporting the change finished. Never hide failures by
weakening tests or checks. Record pre-existing failures separately with evidence.

## Web runtime

`pnpm dev:watch` runs Vite and continuous Convex sync; `pnpm dev` starts only Vite.
`pnpm preview` runs a development-mode build in Wrangler. Use the host's shared
browser surface when available. Exercise the changed journey, relevant failure
states, and refresh; report inaccessible authenticated areas explicitly.

Routes are under `src/routes/`, navigation is in `src/components/navItems.ts`, and
backend calls identify their owning `convex/` modules. Resolve the current imports
rather than using an incomplete copied route map.

## Mobile runtime

Read [mobile releases](../../../docs/runbooks/mobile-releases.md) for building a compatible
development client and starting Metro. Use a free port for this checkout; do not
kill another worktree's server. Confirm the bundle and backend belong to this task.
Do not assume Expo Go contains custom native modules or Sentry integration.

Use the host's device tools to discover/open the intended simulator or emulator,
then drive the affected journey. On iOS verify native navigation/sheets, keyboard,
Dynamic Type, themes/locales, safe areas, and relevant gestures. On Android verify
its adapters, Back/keyboard dismissal, edge-to-edge insets, and relevant gestures.
A physical device is needed for tactile haptics and final device-feel acceptance.

Jest cannot establish native layout, permission dialogs, gesture/worklet runtime,
or UIKit/Compose behavior. Capture screenshots for layout and short recordings
for changed navigation, sheets, keyboard movement, or gestures. Identify the build,
device, backend, locale/theme, and untested paths. See the
[iOS acceptance checklist](../../../docs/verification/ios-native-checklist.md) and existing
reports/evidence linked from the docs index.

Mobile routes are under `apps/mobile/app/`, screens under `apps/mobile/src/screens/`,
and platform primitives under `apps/mobile/src/ui/`. Nutrition's local persistence
is under `apps/mobile/src/data/`; domain catalogs/calculations are in `packages/core`.
Verify offline behavior when that branch changes: cached history stays readable;
an unavailable day explains its absence rather than showing indefinite loading.
