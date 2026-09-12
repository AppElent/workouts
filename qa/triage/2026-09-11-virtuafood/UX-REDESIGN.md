# Nutrition UX redesign — approved A / A / A

Approved by the user on 12 September 2026, with the addition of long-press Copy and Move on diary rows. Work is in the existing checkout; no worktree, deployment or commit is part of this task.

## Design decisions

- Add food is a search-first browser: search field, barcode and plus controls; Recent by default; Favorites, Combos, Recipes and All foods in one horizontally scrollable tab strip. Typing from Recent switches to All foods so a first-time user can search without any history. Secondary capture/create actions belong in the plus menu. No inactive AI control.
- Personal food is a compact, localized form: one primary name, optional translation, numeric nutrient fields, expandable details and servings. Blank remains unknown, zero remains an actual zero, and trace remains a distinct value.
- Diary shows a compact date/goal summary followed by meals. Per-meal menus contain copy and Combo creation. Secondary nutrition tools are behind the toolbar menu. Existing app-wide tabs are unchanged.
- Row tap edits the portion. Long press and a visible ellipsis expose Copy and Move, alongside Edit and Delete. Screen-reader custom actions provide the same operations. Swipe remains an accelerator, not the only route to an action.
- Copy creates a new snapshot with a new identity and no inherited Combo group. Move updates the original entry's date/meal atomically. Both use the existing durable offline operation service.

The mobile design guidance shaped progressive disclosure, minimum touch targets, scalable labels, localized controls and matching loading states. This is not a claim of physical-device visual verification.

## On-device acceptance checklist

Use Dutch first, then English. Test normal and enlarged system text, ideally on the narrowest iPhone you support.

- Diary: date controls, energy heading, macro labels and meal titles fit; first meal is easy to reach; last entry scrolls fully clear of the tab bar.
- Add food: Recent is initially selected; the tab strip scrolls to all five tabs; the search field remains usable beside its two icons. Empty lists explain what to do next.
- Tap a food to inspect/change its portion; use its trailing plus to log the displayed default/last-used portion. Rapid taps must not create accidental duplicates while saving.
- Barcode opens scanning; plus exposes the intended one-off/create/capture choices; back/cancel keeps the selected date and meal.
- Favorites, Combos and Recipes show actual saved content. Verify their detail/log actions and the target meal/date after returning.
- Create food: enter only the primary name; expand optional translation and other nutrients. Save a decimal-comma amount, an explicit zero, an unknown field and a trace field; reopen and verify each remains distinct.
- Form keyboard: active fields and Save remain reachable; optional sections do not crop labels; cancel, validation and storage failure preserve expected input behavior.
- Long-press a diary row, then repeat through its visible ellipsis: Copy to another meal/date leaves the source; Move relocates it without duplication. Verify an expanded Combo ingredient too.
- Repeat Copy/Move while offline; reconnect and confirm one matching result. Close/cancel and unchanged-destination Move must not write anything.
- Delete still asks for confirmation. Meal actions still offer Copy meal and creating a Combo from that meal's entries.
- VoiceOver: food rows, barcode/plus/ellipsis, tabs and destination choices have useful names and states. Reduce Motion does not introduce unnecessary motion.

## Automated verification

Final results on 12 September 2026:

- `pnpm --filter @workouts/mobile test --runInBand`: 44 suites, 267 tests passed.
- `pnpm test`: 35 files, 282 tests passed.
- `pnpm --filter @workouts/mobile typecheck`: passed.
- Scoped `pnpm check` over the 26 changed mobile files: passed, no fixes needed.
- `git diff --check -- apps/mobile`: passed.

The sandbox initially blocked formatter/dependency access; final checks ran with normal local filesystem access. No test assertions were disabled or timeouts increased. Emulator/physical visual verification is deliberately not included; the checklist above is the remaining user acceptance gate. No dependency changes, backend deployment or commit were made for this redesign.
