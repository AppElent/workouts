# Proposed shared guidance (from the Workouts nutrition diary, log food, weekly overview, goals editor, food library and combo editor studies)

Draft for `AppElent/developer-tools`. Not yet filed.

## Proposed guidance

**general/design.md**
- Before redesigning a screen, inventory every action, menu item, and state that the shipped screen offers. A redesign keeps each one or removes it deliberately.
- Each summary figure leads to its full set and to its sources: what contributed, ranked by contribution, and each source opens its editor. Totals that are incomplete or approximate are marked as such, and the missing inputs are listed with an action to fill them in.

**general/design.md** (libraries and composites)
- A list screen shows at most one status line at a time, in a fixed priority (loading › load failed › needs attention › offline). "Needs attention" opens each problem with the action that fixes it.
- An empty section in a sectioned list stays visible with one line that says how to fill it, so the kind remains discoverable.
- Deleting an object that others reference names those references in the confirmation and states what stays unchanged (history).
- Every task that sets an amount (edit a logged item, a part of a composite, a one-off adjustment) uses one amount editor; only the title, the comparison column, and the toolbar differ. Closing without confirming discards; no separate reset action.
- A composite object is edited in place: each confirmed change to a part is saved at once, with no edit mode or Save.

**general/design.md** (period reviews)
- A review of a period compares each day with the goal that applied on that day. A goal change inside the period is shown where it happens, and days without an applicable goal carry no status and are left out of "x of y days" counts.
- A period figure (average, days within goal) leads to its days and, from a day, to that day's sources.

**mobile/design.md**
- Row actions use three routes with one action set: swipe reveals at most two frequent actions and never commits on a full swipe; long press shows the full set; screen readers get them as custom actions. A visible route (an editor, a menu, or selection mode) remains.
- Bulk actions use a selection mode (count in the title, per-section "all" toggle, bottom toolbar), not separate per-section screens.
- Date destinations show nearby days directly and a calendar for any other date.
- Period navigation mirrors day navigation: nearby periods directly in a strip that ends at the current period, and a calendar that selects a whole period, instead of previous/next buttons.
- An add action that commits in one tap confirms with an undoable toast and an in-place update of the target, instead of a confirmation step.
- Editing a saved set of values happens in a draft: save is disabled until something changes, leaving with changes asks to discard, and draft-wide actions (apply a preset, remove all) use an undo toast instead of a confirmation.
- When an existing number gets focus, show it greyed as the placeholder so the first keystroke replaces it; leaving without typing keeps the old value. Screen readers still read the saved value.

**general/design.md** (search)
- Searching the user's own library filters locally on every keystroke; a third-party catalogue is offered only as a link, so importing stays a deliberate step.
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

Workouts `designs/nutrition/diary_round2.html`, `diary_round3.html`, `diary_final.html`, `log_round2.html`, `log_round3.html`, `log_final.html`, `week_round2.html`, `week_round3.html`, `week_final.html`, `goals_round2.html`–`goals_round4.html`, `goals_final.html`, `library_round2.html`, `library_round3.html`, `library_final.html`, `combo_round1.html`–`combo_round3.html`, `combo_final.html`. Open Food Facts API docs (consulted 2026-10-06): 10 search requests/min/IP, explicitly not for search-as-you-type. Uncommitted at the time of drafting. Existing iOS `InsetList` (SwiftUI `List` + `ContextMenu` + `SwipeActions` with `allowsFullSwipe={false}`) demonstrates the row contract.

## Acceptance

The rules appear in the shared files above, stay platform-neutral where marked general, and don't conflict with the existing gesture and toolbar rules.
