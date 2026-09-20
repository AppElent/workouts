# Foundry native redesign — plan

Branch `AppElent/UI-Redesign`. Written 2026-09-18; revised after each step.

## Goal

`apps/mobile` should feel like a real iOS app, not a rendered web page.
`designs/foundry/` is the design contract (tokens, rules, component
inventory). `@expo/ui/swift-ui` is the implementation on iOS wherever it has
the component; React Native draws only what SwiftUI cannot. Android keeps the
existing RN fallback and is not reworked in this plan.

The web app adopts the Foundry palette later, as its own branch. Nothing here
touches `src/`.

## Where the app stands (2026-09-18)

Chrome is already native: `NativeTabs` with SF Symbols and the iOS 26 bottom
accessory, large-title `systemUltraThinMaterialDark` headers, `formSheet`
presentations, edge-swipe back, and a five-event haptics vocabulary
(`src/feedback/haptics.ts`). `@expo/ui` is used in five files: the SwiftUI
swipe row (Exercises only), the plate / set-edit / food-editor sheets and the
Nutrition header menu.

Content is hand-drawn RN, and that is the HTML feel. `train.tsx` is the
specimen: `Pressable` cards with inline Start/Edit/Delete, decorative filter
chips, `"Loading…"` text instead of a skeleton, hardcoded English, a
gesture-handler swipe row on three of four list screens, a custom
`Segmented`, custom form rows.

## The one rule this plan adds to Foundry

**Where SwiftUI draws it, the system's look wins.** An inset-grouped `List`,
a `Form`, a segmented `Picker`, a `ConfirmationDialog` get the OS's corners,
material and spacing; we only tint them with the accent and feed them
Foundry's copy. Foundry's radii, hairlines and "elevation is colour" apply to
the RN-drawn content that remains: stat boxes, the hero/routine card, the
session card, charts' surroundings. Do not force `radius.card` onto a
`UITableView`.

## Component mapping

| Foundry | iOS (`@expo/ui/swift-ui` 57.0.18) | Android / fallback |
| --- | --- | --- |
| InsetList / InsetRow / DisclosureRow | `List` (insetGrouped) + `Section` + `NavigationLink` / `Label` | existing RN rows |
| FormSection / FormTextField / InlineNumberFieldRow | `Form` + `Section` + `TextField` + `LabeledContent` | `src/ui/form.tsx` |
| Segmented | `Picker` (segmented) | `src/ui/segmented.tsx` |
| StepperField | `Stepper` | existing |
| Sheet | `BottomSheet` / router `formSheet` | existing |
| ConfirmDialog | `ConfirmationDialog` / `Alert` | `src/ui/confirm-dialog.tsx` |
| EmptyState | `ContentUnavailableView` | `src/ui/empty-state.tsx` |
| ProgressRing | `Gauge` | RN |
| TrendChart / BucketChart | `Chart` (Swift Charts) | `react-native-gifted-charts` |
| SwipeableRow | `SwipeActions` + `ContextMenu` | `src/ui/swipeable-row.tsx` |
| SearchField | Stack `headerSearchBarOptions` | same (react-native-screens) |
| NavBar actions | `Toolbar` / Stack `headerRight` | same |
| Toast | RN (SwiftUI has no toast) | same |

Foundry's `.jsx` mocks are not ported. Its `.d.ts` files are the shared prop
contracts for the `.ios.tsx` / `.tsx` split.

## Step 1 — tokens (done, `8d0a5406`)

`apps/mobile/src/theme/tokens.ts`:

- Add `accentInk` (= accent in dark, olive `#55700c` in light), `warnSoft`,
  `warnBorder`, `separator`, `successSoft`.
- Add the light ramp from `designs/foundry/tokens/light.css` as `colorsLight`;
  `useTokens()` reads `useColorScheme()`. `app.json` keeps
  `userInterfaceStyle: "dark"` pinned, so nothing renders differently yet —
  the light ramp goes live per screen once each screen reads `useTokens()`
  instead of the static `colors` object (steps 2–3) and passes device QA.
- `sportMeta` gains `colorLight` / `dimLight`.
- Type ramp: add the native iOS layer — `largeTitle` 34/700 (−0.8),
  `navTitle` 17/600, `row` 17/600 (−0.2), `secondary` 15/400, `footnote`
  13/400, `control` 16/600. The existing named ramp stays for content.
- `radius`: add `card` 14, `cardLg` 18, `list` 14.
- `metrics`: `rowMinHeight` 52 → 48, `fieldMinHeight` 48 → 44,
  `sectionGap` 24 → 18 (Foundry's density pass); add `formGutter` 16,
  `controlHeight` 46, `separatorInset` 16, `formMaxWidth` 640. These three
  reductions are visible on every existing form screen — intended.
- Add `motion` (`easeIos`, `durFast/Base/Sheet`) and `opacity`
  (`pressed`, `disabled`).
- Rewrite the file header: the web now adopts this palette; the "do not
  transcribe" warning is retired.

`apps/mobile/app.json`: `backgroundColor` `#000000` → `#0a0b09` (root and
android), `expo-notifications` colour `#1DB954` → `#c8f73c`.

Outcome: typecheck clean for `apps/mobile` (two pre-existing errors in
`packages/core/src/nutrition/library.ts` — `nutrientOrder` is `string[]`
where a literal union is expected — are a separate issue). Jest 360/363; the
three failures are timeouts under full-suite load on Windows (~170 s) and
pass in isolation. The row-height change is checked on device with step 3.1.

What step 1 surfaced, and what it changes below:

- The dark palette already matched Foundry (Foundry was read from this
  file), so the visible diff is the density metrics only.
- `useTokens()` has **zero** call sites outside `src/theme`. 74 files read the
  static `colors` object, mostly inside module-scope `StyleSheet.create`.
  Light mode is therefore not a switch; it is the migration in steps 2–3.
- `AppText` is the lever: every text colour in the app goes through it. Making
  it resolve `color` from `useTokens()` (ramp colour as the dark default,
  scheme colour applied on top) makes text light-ready in one change, before
  any screen is touched. That is now step 2.0.
- `AppText` already accepts the new native variants (`variant="row"` etc.)
  since its prop is `keyof typeof type` — nothing else needed there.
- The five SwiftUI `Host`s hardcode `colorScheme="dark"`; a `useHostScheme()`
  helper next to `useTokens()` fixes all five at once (step 2.0 too).

## Step 2 — primitive seam

Rebuild `apps/mobile/src/ui/` primitives on the `.ios.tsx` (SwiftUI) /
`.tsx` (RN) split, one PR per group, each reading `useTokens()`:

0. **Done, `d277c8b5`.** Scheme plumbing, no visual change: `AppText` takes
   its ink from `useTokens()`; `useHostScheme()` replaces the hardcoded
   `colorScheme="dark"` on the five `Host`s; `useSportColors()` for the
   sport hues. `lightModeEnabled` (off) is the deliberate switch —
   `useScheme()` ignores the OS scheme while it is off (see the iOS 26
   findings below).
1. **Done, `d5696992`.** `inset-list` — `List`/`Section`/row with leading
   media, title, secondary, value, chevron; swipe + context menu built in.
   First consumer: Train → Library (three rows, no actions). Height is a
   row-count estimate until #88 lands (`useScrollGeometryChange` crashes on
   the installed expo). Finding: `.swipeActions` only works inside a SwiftUI
   `List`, so the per-row `native-swipeable-row.ios.tsx` canary never swiped;
   it is retired when Exercises moves over (3.2).
2. `form` — `Form`/`Section`/`TextField`/`LabeledContent`/`Stepper`/`Toggle`
   behind the existing `form.tsx` names, so screens migrate by import.
3. **Done.** `segmented` → system `Picker` (segmented) in the accent tint —
   the old "a platform control cannot take our palette" reason is gone with
   `Host colorScheme`/`seedColor`. `empty-state` → `ContentUnavailableView`
   for the "search" appearance; the inline sentence stays RN. `confirm-dialog`
   already presents a system `Alert` on iOS with a destructive-styled verb —
   that *is* the native pattern for "Delete X?" with a consequence line, so
   it is unchanged (`ConfirmationDialog` is the action-sheet form; not needed).
4. **Done.** `chart` → Swift Charts (`chart.ios.tsx`; the RN file keeps
   gifted-charts for Android; `chart-frame.tsx` is the shared card and empty
   state). New `progress-ring` → `Gauge` circular-capacity; Home's inline
   week ring adopts it when Home is done (see step 3.7).
5. **Done.** `skeleton` gains `SkeletonList` (inset rows) and `SkeletonCard`.
   All three read `useTokens()`.

2.2 `form` is deliberately last: it follows the routine editor (3.1).

Each primitive: a jest test that the SwiftUI props are bound (pattern in
`swift-ui-surfaces.test.tsx`), and a row in `docs/ios-native-verification.md`.

## Step 3 — screens, lists first

**Ordering change (2026-09-20):** 3.1 Train runs *before* 2.2–2.5. Train is
the real test of the inset list — routines as rows with Start/Edit/Delete
as swipe + long-press actions — and each later primitive should be built
against a screen that needs it, not ahead of one. 2.2 `form` follows for the
routine editor.

**Current status:** next up is 3.1. Before it: your device look at Train →
Library (row in `docs/ios-native-verification.md`) — group height, system
look, tap and drag. Emulator (Android, RN fallback) already renders it.

Order chosen by how much card-stack there is to remove and how many
primitives each exercises. Each screen answers the screen contract in
`apps/mobile/DESIGN_SYSTEM.md` in its PR description, moves its strings into
`src/i18n/messages`, replaces `Loading…` with a skeleton, and gets a device
pass before the next starts.

1. **Train** — routines as an inset list (row opens the editor; Start is the
   swipe/context action and the row's trailing button), library section,
   one primary capsule. Filter chips go until a second activity type exists.
2. **Exercises** — `headerSearchBarOptions`, filter as a `Picker`, inset
   list with `MediaThumb` slot.
3. **Profile / Language** — pure inset-grouped settings; the cheapest
   full-native screen and the light-mode pilot.
4. **Session** — set rows as an inset list, set type `Picker`, `Stepper`
   fields, rest timer stays RN.
5. **Progress** — Swift Charts, `Gauge` week ring, stat boxes stay RN.
6. **Nutrition** — largest surface, last; diary rows, goal card, calendar.
7. **Home** — was missing from this list. Week ring → `ProgressRing`,
   recent sessions → inset list, sport tiles stay RN.

Out of scope: Android Compose variants, the web app, photography slots
(fallbacks only), a logo.

## iOS 26 chrome findings (2026-09-18/19, dev build, physical iPhone)

Learned while chasing the "blank band at the top" and the light tab bar.
They constrain every step below.

- **The header's trait is not the app's.** With `userInterfaceStyle: "dark"`
  baked into Info.plist, the stack header still resolved `DynamicColorIOS`
  against the *light* trait while the tab bar resolved dark. Stack headers
  therefore take static scheme colours (`coach-tab-stack.tsx`); only the tab
  bar uses the dynamic `chrome` pairs, because Liquid Glass there genuinely
  flips with the content under it and comes up light for a moment on launch.
  This is why `useScheme()` must ignore the OS until `lightModeEnabled`.
- **No `headerBlurEffect` from iOS 26.** An explicit blur is layered above
  the large title and smears it out; Liquid Glass supplies the material.
  Gate on `isIOS26OrLater()` (`src/ui/platform.ts`). The
  `[RNScreens] blurEffect + scrollEdgeEffects` warning is the tell that a
  bundle still sets one.
- **`setOptions({ title: undefined })` clears, it does not inherit.** A screen
  that sets its own `<Stack.Screen options>` must pass the tab title back
  explicitly (`nutrition-day.tsx`), or the header shows the route name.
- **Branch drift hits the phone first.** The phone and the web share one
  dev deployment; a branch behind `main` rejects ops the phone queued under a
  newer bundle. Merge `main`, `pnpm --filter @workouts/core build`,
  `npx convex dev --once`.

## Open questions

- **`expo` is behind `@expo/ui`.** `@expo/ui` ~57.0.18 was built against
  `expo` 57.0.22 / `expo-modules-core` 57.0.18 and calls
  `useReleasingSharedObjectWithLifecycle`, absent from the installed
  `expo-modules-core` 57.0.10 (`expo` 57.0.12). `useScrollGeometryChange`
  crashes as a result; `inset-list.ios.tsx` gates on expo's version and falls
  back to a row-count estimate until then. Aligning `expo` to ~57.0.22 (8 days
  old, past the 3-day `minimumReleaseAge`) is a native change — a dev-client
  rebuild, which is already owed for the dark pin. Every `@expo/ui` component
  that uses worklet-capable callbacks is exposed to this, not just the list.
  Deferred: [#88](https://github.com/AppElent/workouts/issues/88).

- Light mode ship gate: after Profile (step 3.3) or after all six screens?
  Unpinning `userInterfaceStyle` before every screen reads `useTokens()`
  would show dark cards on a light ground — so the gate is "all screens
  migrated", unless Profile is the pilot behind a per-screen override.
- The jest suite takes ~170 s on Windows and flakes on timeouts under load;
  step 3 PRs should run the touched suites in isolation and let CI (Linux)
  run the full set.
- Pre-existing on `main` after the 2026-09-18 merge, not this branch's to
  fix here: six `tsc` errors in `apps/mobile` (`nutrition-entry-transfer`,
  `nutrition-combos`, `food-library`, `swift-ui-surfaces.test`) and the
  `swift-ui-surfaces` "Create Combo" assertion, all from the batch-selection
  commit `987a66dc`.
- `@expo/ui` stability in SDK 57 — the codebase calls the swipe row a
  "canary until device QA". If `RNHostView` sizing misbehaves inside `List`,
  the fallback is `List` for settings-style screens only and RN inset rows
  elsewhere.
