---
name: run-mobile
description: Run, start, launch, screenshot, and drive the Workouts (Foundry) Expo mobile app on an iOS simulator. Use when asked to run the mobile app, sign in, tap through a screen, take a simulator screenshot, reload Metro, or confirm a mobile change works in the real app.
---

Drive the Expo dev client (bundle `com.appelent.foundry`) on a dedicated iOS
simulator with `.claude/skills/run-mobile/driver.sh`. It creates the simulator,
installs the dev client, starts this checkout's Metro, and opens the app. You
then interact through `driver.sh ad …`, which wraps
[agent-device](https://www.npmjs.com/package/agent-device).

All paths are relative to `apps/mobile/`. macOS only (Xcode + iOS simulator runtime).

## Prerequisites

- Xcode with an iOS simulator runtime. Dependencies come from `pnpm install` at the repo root.
- A built simulator dev client (`Foundry.app` under `~/Library/Developer/Xcode/DerivedData/Foundry-*`).
  If none exists, build once with `SENTRY_DISABLE_AUTO_UPLOAD=true pnpm devbuild:ios`; see
  `docs/runbooks/mobile-releases.md`. Point at another build with `RUN_MOBILE_APP=/path/Foundry.app`.
- `.env.local` with `EXPO_PUBLIC_CONVEX_URL`, the Clerk key, and `EXPO_PUBLIC_TEST_USER_*`.
  **Check the backend before you make writes**:
  `grep CONVEX_URL .env.local | cut -d/ -f3 | cut -d. -f1`. On 2026-10-13 it was the dev
  deployment `colorless-sturgeon-704`. Preview/TestFlight uses `fine-akita-444`, the live backend.

## Run (agent path)

```bash
D=.claude/skills/run-mobile/driver.sh
$D up                      # sim + install + Metro :8090 + open app (~50s fresh, ~10s warm)
$D signin                  # taps "Sign in" (test creds are pre-filled), waits for tab bar
$D signin --email E --password P   # signs in as another user; aborts if the email did not fill
$D ad snapshot -i          # accessibility tree with @refs
$D ad press 'label="Nutrition"' --settle   # tap + print UI diff
$D ad wait text "Nothing logged" 20000     # assert; exit 1 on timeout
$D ss /tmp/shot.png        # simulator screenshot -> prints path
$D reload                  # Metro reload (JS change without relaunch)
$D logs 40                 # Metro log tail (console.log / bundling errors)
$D up --lang nl            # reboot sim in Dutch (en is default); sign-in survives
$D down                    # close session, stop Metro we started, shut down sim
```

`ad` passes arguments straight to agent-device (`$D ad help`, `$D ad help workflow`).
Prefer `label="…"` selectors. Refs such as `@e12` go stale after any action. Use the
`@e12~s123` form printed in the latest diff, or re-run `snapshot -i`.

Knobs (env): `RUN_MOBILE_PORT` (default 8090), `RUN_MOBILE_DEVICE_TYPE`
(default `iPhone 18 Pro`), `RUN_MOBILE_SIM`, `RUN_MOBILE_APP`. Each checkout gets
its own simulator, `Workouts run-mobile <hash>`, and its own state dir (`$D state`).
The state dir holds `metro.log`.

## Test (no app)

Most PRs touch `src/data/*` or feature hooks; Jest covers those directly:

```bash
pnpm --filter @workouts/mobile test --runInBand src/data/nutrition-goal-history.test.ts
```

Full gates are in `docs/runbooks/verification.md`.

## Run (human path)

`pnpm start:dev-client` then press `i`. This uses whichever simulator is booted and
port 8081, which collides with other checkouts. Avoid it for agent work.

## Gotchas

- **Destructive flows (delete data/account) need a throwaway user**, never the pre-filled
  shared account: `node scripts/clerk-test-user.mjs create <name+clerk_test@example.com> <pw>`
  (repo root; dev Clerk only), then `signin --email … --password …`. `exists <email>` checks
  a deletion.
- **Repeated labels** (a button and its confirmation, e.g. `"Load test data"`) are ambiguous:
  take `snapshot -i` and press the confirmation's `@ref` immediately; any other action expires it.
- **The share sheet closes** by pressing its `"dismiss popup"` element (`ad snapshot`, not `-i`).
- **The keyboard has no dismiss key**; scroll the form instead. `ad scroll up` may not reach the
  top of a long screen; `ad swipe 201 250 201 800` does.
- **Files the app writes** (exports, caches) are under
  `xcrun simctl get_app_container "$($D udid)" com.appelent.foundry data`.
- **Many Metros run at once** (other worktrees, port 8081–8086). `up` refuses a port whose
  Metro `cwd` is a different checkout. Never trust "something is on :8081".
- **`simctl openurl` on a fresh sim raises a system "Open in Foundry?" prompt.** `up`
  accepts it with `ad alert accept`. A plain `simctl launch` reopens the last URL instead.
- **The dev menu auto-opens with an onboarding sheet, and its floating gear button covers the
  top-right header buttons** (Nutrition's `…`/calendar). Writing `EXDevMenu*` keys into the
  app's prefs plist does nothing. The working fix is the launcher URL flags
  `disableOnboarding=1&disableFab=1&disableAutoLaunch=1` (see
  `expo-dev-launcher/ios/EXDevLauncherURLHelper.swift`). `up` sends them.
- **New simulators inherit the Mac's language (Dutch here).** The app UI and system alerts
  then use labels such as `Sluit` and `Voeding`, so `up` forces English. Use `--lang nl`
  for Dutch checks.
- **The `agent-device` on PATH in T3 Code is a host wrapper** that refuses to run without
  its MCP session ("Call device_open first"). The driver uses
  `npx -y agent-device@0.21.27` instead. The first call per session prints
  "Building Apple runner…" and takes ~20s.
- agent-device sessions are keyed by **cwd**. Always go through `$D ad` (it runs in the
  state dir); a bare `npx agent-device` elsewhere won't see the open session.
- Other agents/users may shut down or delete simulators mid-run (this happened while
  authoring). If commands start failing with `Invalid device`, re-run `$D up`.
- The installed dev client must match current native deps. After native or config-plugin
  changes, rebuild with `pnpm devbuild:ios`, then delete the sim
  (`xcrun simctl delete "$($D udid)"`) so `up` reinstalls the newest `Foundry.app`.

## Troubleshooting

- `port 8090 is Metro for <other path>` → `RUN_MOBILE_PORT=8091 $D up`.
- `Unable to boot device in current state: Booted` on a language change → fixed in the
  driver (it now waits for `Shutdown`); re-run `$D up --lang …`.
- `Ref @e12 needs a complete snapshot` → use the `@eN~sNNN` ref from the latest output, or a
  `label="…"` selector.
- `Selector did not match: label="Nutrition"` → the sim is in another language; run
  `$D ad snapshot -i` and use the labels shown, or `$D up --lang en`.
- `$D signin` → `sign-in screen not visible` → already signed in (session persists across
  `up`/reboots).
