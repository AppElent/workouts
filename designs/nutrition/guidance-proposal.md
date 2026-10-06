# Proposed shared guidance (from the Workouts nutrition diary and log food studies)

Draft for `AppElent/developer-tools`. Not yet filed.

## Proposed guidance

**general/design.md**
- Before redesigning a screen, inventory every action, menu item, and state that the shipped screen offers. A redesign keeps each one or removes it deliberately.
- Each summary figure leads to its full set and to its sources: what contributed, ranked by contribution, and each source opens its editor. Totals that are incomplete or approximate are marked as such, and the missing inputs are listed with an action to fill them in.

**mobile/design.md**
- Row actions use three routes with one action set: swipe reveals at most two frequent actions and never commits on a full swipe; long press shows the full set; screen readers get them as custom actions. A visible route (an editor, a menu, or selection mode) remains.
- Bulk actions use a selection mode (count in the title, per-section "all" toggle, bottom toolbar), not separate per-section screens.
- Date destinations show nearby days directly and a calendar for any other date.
- An add action that commits in one tap confirms with an undoable toast and an in-place update of the target, instead of a confirmation step.

**general/design.md** (search)
- Results from a rate-limited third-party provider form their own section beside local results. Query the provider only for a settled term (explicit submit or a typing pause with a minimum length), never per keystroke; cache per term and stay within an app-side budget below the documented limit. When limited, only that section waits and retries.

**ios/design.md**
- When repeated sections need actions, make the section title the menu trigger (`Title ⌄`) rather than repeating an overflow button beside each section's primary control.
- Tab roots use the native large title that collapses on scroll; keep screen actions in the navigation bar, not beside the title.
- On iOS 26+, a pushed screen without a tab bar puts its primary search in the system bottom toolbar (search slot plus at most a few actions) rather than a custom floating control; earlier iOS versions keep an in-content search row.

## Why

Round-based design reviews kept surfacing the same gaps: redesigns silently dropped existing actions, gestures were the only route to an action, repeated ⋯ buttons cluttered lists, and summary cards answered "how much" but not "from what".

## Scope

General, mobile, and iOS design guidance. No code or component contracts.

## Evidence

Workouts `designs/nutrition/diary_round2.html`, `diary_round3.html`, `diary_final.html`, `log_round2.html`, `log_round3.html`, `log_final.html`. Open Food Facts API docs (consulted 2026-10-06): 10 search requests/min/IP, explicitly not for search-as-you-type. Uncommitted at the time of drafting. Existing iOS `InsetList` (SwiftUI `List` + `ContextMenu` + `SwipeActions` with `allowsFullSwipe={false}`) demonstrates the row contract.

## Acceptance

The rules appear in the shared files above, stay platform-neutral where marked general, and don't conflict with the existing gesture and toolbar rules.
