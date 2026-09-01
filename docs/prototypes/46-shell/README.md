# Shell prototype — issue #46

Three shells of the same app, built to be judged in the hand rather than on
paper. Screenshots are from a Pixel 9 Pro emulator running the real app against
the real Convex backend (54 exercises, real session history).

Run it: `pnpm --filter @workouts/mobile start`, open on a device, then use the
red pill at the bottom to cycle variants. The pill is dev-only (`__DEV__`) and
deliberately off-palette so it reads as scaffolding, not design.

| Variant | Navigation | Destinations | Cold-launch resume | Sign-out |
| --- | --- | --- | --- | --- |
| **A — Home base** | Single stack, no tab bar | Home; Exercises pushed | Banner on home (mirrors the web's `ActiveSessionBar`) | Home header |
| **B — Tabs with a verb** | `NativeTabs`: Home \| Start \| Exercises | Home + Exercises are tabs; Start is a `disabled` trigger that pushes | Redirect straight into the session | Home header |
| **C — Session first** | Single stack, front door *is* the action | Start only; Exercises + History behind small header links | Hard redirect | Start-screen header |

## Screenshots

- `variant-a-home-base.png`
- `variant-b-tabs-with-a-verb.png`
- `variant-b-verb-tab-pushes-session.png` — the verb tab pushing the session over the bar
- `variant-c-session-first.png`
- `signed-out.png` — the sign-in screen, moved onto the theme tokens

## Two things found on the emulator, not by reading

1. **You cannot swap the navigator under one route.** Returning `Stack` for one
   variant and `NativeTabs` for another from the same `_layout` crashes:
   expo-router keeps navigation state per route, so the tab router is handed the
   stack's state and dies on `state.preloadedRouteKeys.filter`. Each variant
   therefore owns its own route, and variant B's tab bar lives in `(tabs)`.
2. **ADR-0018's verb tab works on Android.** A `disabled`
   `NativeTabs.Trigger` still emits `tabPress`, and `router.push` from that
   listener lands on the *parent* stack — so the session covers the tab bar
   instead of appearing inside it. Confirmed, not assumed.

## What is throwaway and what is not

Throwaway (`apps/mobile/src/prototype/`, the variant route files, the pill):
delete once a variant wins.

Not throwaway: `apps/mobile/src/theme/` and `apps/mobile/src/ui/`. Those are
decision 3 (theme) and the primitives every variant already draws with.
