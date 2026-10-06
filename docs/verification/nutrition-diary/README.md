# Nutrition Diary redesign implementation

## Current status

Implemented on the live routes in commit `93fc69a` on `t3code/entry-editor-redesign`.
The subsequent main merge relocates this report and its evidence into the adopted
documentation structure; implementation behavior is unchanged.
Scope: [agreed brief](../../product/nutrition-diary-redesign.md).
Reference: [selected final board](../../../designs/nutrition/diary_final.html), copied
unchanged from the main worktree because it was not present in committed main.
The first visual pass missed substantial differences, corrected in a second
reference comparison on 2026-10-06. Automated checks pass. iOS verification is
partial; full visual acceptance remains
open for the states listed below. Observations dated 2026-10-06.

## File ownership and placement

Paths below are relative to `apps/mobile/src/features/nutrition/` unless stated otherwise.

| Files or folder | Responsibility and placement rationale |
| --- | --- |
| `diary/diary-screen.tsx` | Live diary composition, selected date, intake selection, and navigation. Replaces the legacy nutrition-day screen. |
| `diary/use-logged-diary-dates.ts` | Combines local and remote logged-day indicators; state stays beside its owning screen. |
| `diary/components/diary-calendar.tsx`, `diary-date-picker(.ios).tsx`, `diary-selection-actions.tsx`, `diary-week-strip.tsx` | Diary-specific date navigation, anchored calendar popup, and labeled selection actions. |
| `diary/components/diary-summary.tsx`, `diary-meal-card.tsx`, `diary-meal-menu.tsx` and `.ios.tsx` | Summary, meal rows, and native/fallback meal actions. Supporting UI stays below the subject, rather than alongside screen entry points. |
| `diary/diary-screen.test.tsx`, `diary/__tests__/` | Directly paired screen tests remain beside the screen. Scenario suites cover navigation, accessibility, drafts, Combos, loading, errors, goals, row actions, and offline behavior; these do not imply separate implementation files. The former day-goals-empty suite belongs here because it starts from the diary. |
| `diary-entry/diary-entry-editor-screen.tsx` | Reuses the first redesign and promotes its editor and food-detail navigation to live routes. |
| `diary-entry/components/` | Moves quantity, serving-popup, and keyboard-overlay helpers out of the subject root. Their owner remains Diary Entry. |
| `diary-entry/diary-entry-transfer-screen.tsx` | Moves existing copy/move behavior into the feature structure, preserving durable batch operations. |
| `diary-entry/diary-entry-correction-screen.tsx` | Owns the correction draft, validation, source update, selected snapshot update, and retry/error presentation. |
| `diary-entry/*.test.tsx`, `diary-entry/__tests__/diary-entry-live-route.test.tsx` | Paired screen tests plus a separate live-route integration scenario suite. |
| `day-goals/day-goals-screen.tsx`, `goal-presentation.ts`, `components/nutrition-goal-card.tsx`, `components/goal-row-menu(.ios).tsx` and paired test | All-goals sheet, shared goal presentation calculations, and subject-local goal card. |
| `nutrient-sources/nutrient-sources-screen.tsx` | Nutrient total, meal distribution, missing entries, ranked contributors, and correction entry point. |
| `components/nutrition-header-menu*`, `nutrition-menu.tsx`, `nutrition-native-surfaces.test.tsx` | Nutrition-wide menus and native adapter coverage shared across subjects. |
| `apps/mobile/app/(app)/nutrition-*.tsx` | Thin live route wrappers for entry, details, transfer, goals, sources, and correction; route parameters and native sheet presentation remain navigator responsibilities. Labs aliases reuse live destinations. |
| `apps/mobile/src/ui/inset-list*`, `nutrition-calendar.tsx`, `tab-bar-visibility.tsx` | Domain-independent platform support: list headers/selection, calendar markers, and hiding tabs during selection. |
| `apps/mobile/src/data/nutrition-{day,local-repository,operation-service}.*` | Canonical persistence and operation projection retain snapshot metadata and support targeted nutrient correction. No parallel feature repository. |
| `packages/core/src/nutrition/diary-correction.ts`, `nutrient-sources.ts`, exports and operation types | Shared nutrient scaling, correction scope, and source ranking, reusable by client and backend. |
| `convex/nutritionDiary.ts`, `nutritionDiaryModel.ts`, `nutritionOperationModel.ts` and tests | Authenticated logged dates, correction validation, and durable server application. |
| `docs/guidelines/project/mobile-folder-structure.md`, brief, ADR 0011, `CONTEXT.md` | Record live feature adoption, component/test ownership, and the explicit exception to historical snapshot immutability. |

Legacy consumers received import plumbing where shared controls moved. Unrelated
legacy screens were not broadly rewritten. The feature structure is now used by
production navigation rather than only Labs.

## Behavior and reference choices

The diary uses native navigation, week paging, the existing marked calendar,
energy/macronutrient summary, meal cards, and native selection actions. Native
menus and routed sheets replace illustrative HTML controls. Capture Drafts remain
separate from intake totals and batch selection. Existing durable copy/move
operations take precedence over the HTML's per-entry example code.

“Aanvullen” updates the source Food and only the tapped Diary Entry. Shipped Food
corrections create or reuse a Fork. Only explicitly corrected nutrient fields are
scaled to the entry's historical amount; other snapshot fields and all other
entries remain unchanged. Without an available source, correction affects only
that entry and does not invent a Food. A source-save/diary-save failure is disclosed
and retries reuse the saved source. Ordinary Food edits still do not refresh history.

## Automated verification

- Mobile Jest: 73 suites, 485 tests passed, including correction, live navigation,
  batch transfer, offline projection, and existing behavior regression coverage.
- Root Vitest: 49 files, 389 tests passed, including correction scaling and backend operations.
- Root and mobile type checking passed.
- `pnpm check` passed, including mobile architecture boundaries.
- `pnpm build` and `git diff --check` passed.

Scenario-test relocation preserves assertions and updates relative imports and
mock paths. Tests establish behavior and wiring, not native gesture or layout acceptance.

## Visual correction pass — 2026-10-06

The initial implementation did not sufficiently match the reference. The second
pass corrected these observed differences:

- Restored the native large title using the current navigator option and separated
  the calendar and overflow into individual native toolbar controls.
- Removed outer SwiftUI section margins from diary cards, reduced meal-header
  height, used compact empty-meal headers, and restored tinted circular add buttons.
- Matched the summary's 96-point ring, stronger status/value hierarchy, rounded
  surface, and exception badge. No-goals combines totals and setup inside one surface, with a separator.
- Selection keeps food visuals beside circular checks, hides the week strip and
  summary, and uses a native glass toolbar with visible icons and labels.
- Goals open expanded, remove duplicate internal heading/edit chrome, and separate
  nutrient, target, consumed amount, progress, status, and disclosure.
- Sources use an aligned title/date header, a neutral or exceeded-total hero,
  meal-color legend, white/semantic source surfaces, percentage/contribution bars,
  and a tinted missing-value action.
- Transfer uses a content-sized sheet, a count/action title, four compact meal
  segments, a calendar tile, and one impact line. Expanding the calendar resizes
  the sheet without clipping its controls.
- Dutch summary and goal figures use decimal commas.
- Outstanding Capture Drafts mark their actual day with a note symbol in the
  horizontal week strip. The separate other-days reminder/link is removed.
  Logged-intake dots remain distinct, and accessible date labels announce note
  counts. Tapping a marked day opens that date.

New helper `nutrient-sources/components/nutrient-source-value.tsx` belongs to its
subject. Generic `InsetList` gained compact embedding and custom trailing content;
`Segmented` can opt into four compact segments while preserving its larger-text
fallback. The new `radius.contentCard` token is opt-in. These changes retain the
native list gestures rather than replacing them with drawn imitations.

## Runtime evidence and remaining acceptance

Observed the installed Foundry development client on the Foundry Build Check iOS 27
simulator (402 × 874 logical points), served from this worktree on Metro 8084.
Runtime writes used isolated development deployment `rugged-stork-227`; no
production deployment was performed. Captures represent the uncommitted working
tree on 2026-10-06. The floating gear is development-client tooling.

Latest review fixes (English, light, standard text on the same simulator):

| State | Evidence and result |
| --- | --- |
| Calendar | [Anchored popup](assets/ios-review-calendar-popup.png): opens over the diary and dismisses outside without moving its content. |
| Large totals | [11,656 kcal summary](assets/ios-review-summary.png): constrained ring text and consistent target line under each macro amount. |
| Selection | [Labeled native toolbar](assets/ios-review-selection.png): four icons with visible text and red Delete. |
| No goals | [Combined diary card](assets/ios-review-empty.png) and [goals sheet](assets/ios-review-empty-goals.png): one diary surface and restored sheet-card padding. |
| Swipe | [Actions](assets/ios-review-swipe-final.png): design gray Edit on the left, red Delete on the right. Full swipe remains reveal-only, per reference. |
| Food menu | [Native context menu](assets/ios-review-item-menu-final.png): action icons, neutral tint, destructive red, separators, and menu-specific wording. |
| Meal menu | [Native meal menu](assets/ios-review-meal-menu-final.png): meal/count heading, icons, separator, copy/move ellipses. |
| Nutrient menu | [Lifted nutrient row](assets/ios-review-goal-menu-final.png): native context menu replaces the action sheet; largest sources, edit goal, separator, change order. Capture predates the final wording change from “Reorder goals” to “Change order” / “Volgorde wijzigen”. |

The native calendar now opens as an anchored popover rather than expanding the
screen. Opening and outside-tap dismissal were exercised; the diary remained
interactive. Native context-menu backdrop blur is system-controlled: its intensity
still differs from the HTML reference. This is an unresolved visual difference,
not a claim of exact blur matching. Swipe presentation likewise uses the current
iOS capsule buttons rather than the HTML's rectangular illustration.

Earlier visual evidence (historical where these latest controls supersede it):

| State | Evidence and result |
| --- | --- |
| Dutch diary, light | [Revised diary](assets/ios-diary-nl-light-revised.png): large title, separate native actions, summary and compact meal cards. |
| Dutch diary, dark, XL | [Revised diary](assets/ios-diary-nl-dark-xl-revised.png): hierarchy and controls remain readable. |
| Earlier-day notes | [Week-strip marker](assets/ios-note-marker-nl-dark-xl.png) and [opened day](assets/ios-note-day-nl-dark-xl.png): created a local test note for October 5 and opened it from October 6. The opened-day capture predates the final shorter setup explanation. |
| Selection | [Revised selection](assets/ios-selection-nl-revised.png): selected food visuals, compact headers, no summary/week strip/tabs, native toolbar. |
| Transfer | [Nearby dates](assets/ios-transfer-nl-revised.png) and [expanded calendar](assets/ios-transfer-calendar-nl-revised.png): all controls visible, no submission during this visual pass. Earlier functional pass copied two entries successfully. |
| Goals | [Dark XL goals](assets/ios-goals-nl-dark-xl-revised.png): expanded native sheet, separated target/amount, localized decimal figures. |
| Sources | [Dark XL sources](assets/ios-sources-nl-dark-xl-revised.png): centered title/date, aligned ranking figures, percentage and contribution bars. |

Earlier captures without `revised` in the filename predate these corrections and
are historical evidence only. The earlier navigation recording also predates this
visual pass. English and Dutch were exercised; current retained revised images
focus on Dutch, which matches the reference locale.

Still open: full collapsed-header and week-paging gesture comparison; full native
context-menu matrix in Dutch/dark/XL after the latest adapter changes; stronger
reference backdrop blur; runtime missing-value layouts; correction
keyboard/dirty/error journey; disconnected runtime acceptance; Android runtime and
physical-device haptics. Automated tests cover the relevant behavior contracts but
do not establish those native states. Full reference acceptance is not claimed.
