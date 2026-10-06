---
name: verify
description: Verify Workouts changes through the affected web/mobile target and report actual runtime coverage.
---

# Verify Workouts

Read root coding/design standards and [the docs index](../../../docs/README.md).
Shared guidelines own generic verification rules. This file owns project commands,
backend selection, test-account behavior, and the route/module starting points.
Documentation-only changes need link/ownership checks, not an invented device pass.

## Implementing a supplied design

When the user asks to build from a supplied design or mockup (HTML, image, Figma,
or equivalent), record the reference and a short list of its applicable states
before implementation. Include open menus, keyboard/nested forms, and
clean/dirty/invalid states when present. Identify native equivalents and discuss
material deviations before committing to them; example code still needs runtime
validation. Ordinary UI fixes without a supplied reference do not require this
comparison checklist.

Before reporting design fidelity complete, compare the running result with the
reference for each listed state. Record current screenshots or recordings, the
build/revision observed, and a pass, agreed deviation, or unresolved result for
each state. After a relevant layout/adapter change, recheck affected states;
earlier evidence does not verify a later revision. Reviewers inspect this evidence
against the reference and call out missing coverage. If runtime access is blocked,
report implementation and automated results separately from pending visual review.

## Backend and login

Use [isolated worktree setup](../../../docs/worktree-setup.md) for concurrent
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

Read [mobile releases](../../../docs/mobile-releases.md) for building a compatible
development client and starting Metro. Use a free port for this checkout; do not
kill another worktree's server. Confirm the bundle and backend belong to this task.
Do not assume Expo Go contains custom native modules or Sentry integration.

For a new or changed combination of native sheets, overlays, keyboard accessories,
or platform hosts, exercise the smallest end-to-end flow on a compatible client
before visual polishing: open, focus, switch inputs/presentations, dismiss, and
reopen. Confirm the parent remains tappable with auxiliary overlays closed. After
changing detents or keyboard placement, repeat the affected flow and check scroll
and safe-area ownership. Record runtime-specific workarounds with their observed
build and reason.

Use the host's device tools to discover/open the intended simulator or emulator,
then drive the affected journey. On iOS verify native navigation/sheets, keyboard,
Dynamic Type, themes/locales, safe areas, and relevant gestures. On Android verify
its adapters, Back/keyboard dismissal, edge-to-edge insets, and relevant gestures.
A physical device is needed for tactile haptics and final device-feel acceptance.

Jest cannot establish native layout, permission dialogs, gesture/worklet runtime,
or UIKit/Compose behavior. Capture screenshots for layout and short recordings
for changed navigation, sheets, keyboard movement, or gestures. Identify the build,
device, backend, locale/theme, and untested paths. See the
[iOS acceptance checklist](../../../docs/ios-native-verification.md) and existing
reports/evidence linked from the docs index.

Follow the [mobile folder contract](../../../docs/mobile-folder-structure.md) for
routes, adopted feature folders, and legacy screens; inspect the actual owner
before editing. Platform primitives are under `apps/mobile/src/ui/`. Nutrition's local persistence
is under `apps/mobile/src/data/`; domain catalogs/calculations are in `packages/core`.
Verify offline behavior when that branch changes: cached history stays readable;
an unavailable day explains its absence rather than showing indefinite loading.

## Evidence and diagnostic output

Keep one current-status section in an implementation report, with observed revision,
checks, and unresolved acceptance. Label older observations as historical and update
superseded behavior descriptions rather than appending contradictory conclusions.
For noisy failures, save the full log locally and inspect the summary plus relevant
failure excerpt first; retain the process exit status. Search dependency source and
declarations with explicit file filters, excluding generated source maps unless
mapping generated code back to source is the task.
