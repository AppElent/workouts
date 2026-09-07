---
name: verify
description: Verify a code change in the workouts app by driving it through the real running app (dev server + Convex backend), not just typecheck/lint/test. Use before claiming a fix or feature is done.
---

# Verify (workouts)

Local-first: use `pnpm dev:watch` (Convex + Vite) and drive the change through
the actual UI/API surface it touches. On web sessions without Convex/Clerk
runtime credentials, verification falls back to the static suite
(`pnpm run check`, `pnpm run typecheck`, `pnpm test`, `pnpm build`) — say so
explicitly rather than claiming the feature itself was verified.

**If the change is in `apps/mobile/`, the static suite is not enough.** See
"Mobile" below: the mobile app has failure modes that are structurally
invisible to Jest.

## Logging in

The sign-in screen shows a "▶ Dev: log in as test user" button (from
`@appelent/auth`'s `TestLoginButton`) whenever `VITE_CLERK_PUBLISHABLE_KEY` is
a Clerk **test** key (`pk_test_...`, never `pk_live_...`) *and* both
`VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` are set in `.env.local`. Use
it to authenticate when verifying auth-gated pages — don't assume a real
Clerk login is required. If the button isn't showing, check `.env.local` for
those two vars before concluding the app can't be tested logged-in.

## Route → module map

<!-- TODO: fill in as routes are verified. Never guess this table. -->

| Route | Convex module(s) | Notes |
| --- | --- | --- |
| `/dashboard` | TODO | |
| `/exercises`, `/exercises/$id` | `convex/exercises.ts` | |
| `/log`, `/log/$sessionId` | `convex/workoutSessions.ts`, `convex/sets.ts` | real-time session |
| `/routines` | `convex/routines.ts` | |
| `/progress` | `convex/progress.ts`, `convex/oneRepMaxes.ts` | |
| `/profile` | TODO | |

---

# Mobile (`apps/mobile`)

## Why the static gates are not enough here

`pnpm --filter @workouts/mobile test` runs Jest against a **test renderer**.
It has no worklet runtime, no native modules, no real layout and no real
accessibility tree. Whole classes of defect pass it and then fail on the first
phone that opens the screen. One that actually happened (#79): a
`react-native-gesture-handler` gesture captured a legacy `Animated.Value`, and
because gesture callbacks are worklets by default the diary crashed with
`[Worklets] Cannot copy value of type AnimatedValue` — with 167 tests green.

Assume anything in this list is unverified until a device says otherwise:

- gestures, worklets, and anything touching `react-native-reanimated` or
  `react-native-gesture-handler`
- `NativeTabs`, native sheet/modal presentation, and the hardware back button
- haptics (`src/feedback/haptics.ts`) — they are fire-and-forget and silent on
  failure by design, so only a hand feels a regression
- dynamic type and clipping, hit-target size, contrast
- anything reading a system accessibility setting (`useReduceMotion`)
- native permission dialogs, including the localized purpose strings in
  `apps/mobile/locales/*.json`

## Running it on the Android emulator

There is no Mac here, so Android is the device (spec #68, D26). iOS-first is a
design instruction, not a verification one.

```bash
# 1. Is the emulator up?
agent-device devices                  # expect: Pixel 9 Pro 2 ... booted=true

# 2. Start Metro from THIS worktree.
#    Check the port first — another worktree may already own 8081:
netstat -ano | grep ":8081"
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ProcessId=<pid>' | Select-Object -ExpandProperty CommandLine"
#    If it belongs to another checkout, use a free port instead of killing it.
pnpm --filter @workouts/mobile exec expo start --port 8082 --go

# 3. Point the emulator at your Metro and open Expo Go.
adb reverse tcp:8082 tcp:8082
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8082" host.exp.exponent

# 4. Drive it.
agent-device open host.exp.exponent --foreground
```

Confirm the bundle came from **your** worktree before believing anything:
Metro's log prints `Android Bundled … (N modules)` when it serves, and the
LogBox stack traces name the absolute path of the checkout that built it.

### Things that will slow you down

- **The app runs in Expo Go**, not a dev client (`host.exp.exponent`). `NativeTabs`
  renders there; `expo-camera` and `expo-sqlite` are bundled with Expo Go.
- **Two LogBox warnings are expected and harmless**: Clerk's development-keys
  notice, and the `wods-list ↔ wod-editor` require cycle. Clear them with
  `agent-device react-native dismiss-overlay` (twice — they queue), or press
  the `Dismiss` node. A snapshot taken with an overlay up returns the LogBox
  tree, not the app.
- **`snapshot -i` refs go stale after any navigation.** Re-snapshot rather than
  reusing a ref; a press on a stale ref silently does nothing.
- **The emulator's locale is Dutch**, so the whole app is in Dutch. That is
  useful — it verifies the message tree for free — but every selector must be
  the Dutch string. See the table below.
- **Route errors are recoverable**: the Nutrition routes render `RouteError`
  with a retry, so a crash shows "Deze dag kon niet worden geopend" plus
  "Opnieuw proberen" rather than a white screen. Pressing retry after a Fast
  Refresh is usually enough to pick up a fix.

### Reaching Nutrition

Tab bar, fifth tab: **Voeding** (English: Nutrition). From the day:

| What | Dutch label on device |
| --- | --- |
| Add to a meal | `Voeg eten toe aan Ontbijt` / `Lunch` / `Diner` / `Tussendoortjes` |
| Move day | `Vorige dag` / `Volgende dag` / `Naar vandaag` |
| Edit an entry | `Item bewerken: <food>` |
| Row actions (long press) | `Wijzig` / `Verwijder` / `Sluiten` |
| Delete confirmation | `Dit item verwijderen?` → `Item verwijderen` / `Item behouden` |
| Goals | `Doelen bewerken` |
| Combos | `Combo maken` / `Combo loggen` |
| Food browser | `Zoek eten`, `Scan barcode`, `Doorzoek alle 2.328 voedingsmiddelen` |
| Serving sheet | title is the food name; close is `Sluit portiekeuze` (`Klaar`) |
| Log | `Eten loggen` |

### Going offline

The diary's offline behaviour is a real branch, not a fallback, so test it:

```bash
adb shell cmd connectivity airplane-mode enable
adb shell svc wifi disable && adb shell svc data disable
# ... verify ...
adb shell cmd connectivity airplane-mode disable
adb shell svc wifi enable && adb shell svc data enable
```

A day already downloaded keeps rendering. Step to a day that was not
(`Vorige dag`) and it must say `Je dagboek voor deze dag staat nog niet op
deze telefoon` with `Niet beschikbaar zonder verbinding` in each slot — never
a skeleton, which would promise data that cannot arrive. The plus controls
stay live, and the shipped food library still searches, because it is in the
bundle.

## Mobile route → module map

Routes are files under `apps/mobile/app/`; screens live in `src/screens/`.
The Nutrition sub-screens are siblings of `(coach)`, so they push *over* the
tab bar.

| Route | Screen | Convex / device module(s) |
| --- | --- | --- |
| `(app)/(coach)/nutrition` | `nutrition-day.tsx` | `convex/nutritionDiary.ts`, `convex/nutritionGoals.ts`, `convex/nutritionActivityMarker.ts` |
| `(app)/nutrition-food` | `nutrition-food-browser.tsx` | `convex/nutritionDiary.ts` (`log`); `@workouts/core/nutrition` for the shipped library; `src/data/personal-food-repository.ts` (SQLite); `src/data/open-food-facts.ts` |
| `(app)/nutrition-entry` | `nutrition-entry-editor.tsx` | `convex/nutritionDiary.ts` (`update`, `remove`) |
| `(app)/nutrition-goals` | `nutrition-goals.tsx` | `convex/nutritionGoals.ts` |
| `(app)/nutrition-combos` | `nutrition-combos.tsx` (`NutritionComboLibrary`) | `convex/nutritionDiary.ts` (`logCombo`); SQLite combos |
| `(app)/nutrition-combo-new` | `nutrition-combos.tsx` (`NutritionComboBuilder`) | SQLite combos |
| `(app)/language` | `language.tsx` | none — `expo-sqlite/kv-store` |

## Mobile static gates

```bash
pnpm --filter @workouts/core build          # required, or typecheck fails TS2307
pnpm --filter @workouts/mobile typecheck
pnpm --filter @workouts/mobile test         # Jest; the rest of the repo is Vitest
pnpm check                                  # Biome covers apps/mobile/src and app
```
