---
type: contract
description: Read when changing the Nutrition Diary, weekly review, Nutrition Goals, Capture Drafts, or diary corrections.
version: 1.0.0
status: current
---

# Nutrition Diary

A person sees what they ate per day and Meal Slot against their Nutrition Goals,
and resolves notes about intake later. Mobile only; the web app has no diary.
Studies: [diary](../../designs/nutrition/diary_final.html),
[weekly overview](../../designs/nutrition/week_final.html),
[goals](../../designs/nutrition/goals_final.html).

## Behavior

### Day screen

- **Header.** Native large title collapsing to inline (`headerLargeTitleEnabled`,
  `headerTransparent` on iOS). Top-right holds at most one direct action (calendar)
  plus a ⋯ menu that keeps every existing screen action. The calendar shows
  logged-day indicators.
- **Rows.** Tap opens the entry editor; other actions follow the shared
  actionable-list contract.
- **Section menus.** A Meal Slot with actions makes its title the trigger
  (`Lunch ⌄`); no ⋯ beside its add button; empty sections have no menu.
- **Selection.** The bulk route. Long press → Select enters it with that row
  selected; the large title shows the count, each section has "All", a bottom
  toolbar replaces the tab bar, and Done exits. Batch actions apply to Diary
  Entries only.
- **Copy and move.** One sheet: the verb (segmented) sets the title, then nearby
  days as tiles plus a calendar tile, then the target Meal Slot, then an impact
  preview.
- **Summary.** A compact card with the leading figures and one "All goals" row
  carrying the worst status as a badge. In the full view a figure lists its
  sources ranked by contribution and split per Meal Slot; a source opens its
  editor. Incomplete totals (`≥`) list items without a value first, each with a
  fill-in action; approximate totals (`~`) say so. Ranking is a pure function in
  `@foundry/core`.

### Corrections

"Aanvullen" updates the source Food and only the tapped Diary Entry, applying only
the explicitly changed nutrients scaled to its logged quantity. Other entries,
including the same Food on the same day, are unchanged. Shipped Foods follow the
Fork behavior. Without a source Food, only the entry changes, the scope is
explained, and no Personal Food is created. See
[ADR 0011](../adr/0011-explicit-nutrient-correction-from-diary.md).

### Capture Drafts

- A draft renders inline under its date and Meal Slot, visually distinct from
  Diary Entries, and never counts toward totals or goals.
- **Create.** The food browser offers "Save as note" whenever the search has text
  and in the no-results state. It saves the text for the current date and Meal
  Slot online, then returns to the diary; the appearing note is the confirmation.
  Typing causes no remote writes.
- **Resolve.** Tap opens the food browser for the draft's date and Meal Slot with
  the note as the query. Leaving after logging at least one entry there removes
  the draft; logging nothing keeps it.
- **Row actions.** Edit text, Change meal, Delete.
- **Other days.** When drafts exist on other dates, one banner line ("N unresolved
  notes on earlier days") opens the oldest.

### Weekly review

- **Period header.** Large title named for the period ("Deze week", "Week 38")
  with its range below. A period strip mirrors the day strip: recent periods as
  chips with logged-day dots, swipe for older; the calendar selects a whole period.
  No prev/next buttons.
- **Period summary.** One card: the leading nutrient per day as SVG bars with the
  goal band; other goals as status squares per day (fill, outline, dash, never
  colour alone); "Alle doelen" with the worst miss. Figures show the average plus
  "x of y days" within goal. A bar opens that day's sources; a source on several
  days asks which day first.
- **Goals over time.** Each day compares with the goal effective then. A goal
  change steps the band and adds one line naming it. Days before the first goal
  are neutral and excluded from "x of y days".
- **Day rows.** Tap opens the day; long press offers open, that day's goals, and
  copy. No swipe or selection mode. Each day shows its draft count; completing a
  day with drafts asks for confirmation but is allowed.

### Goals editor

- A `formSheet` draft editor with ✕/✓ that locks while saving; failures use the
  retry toast.
- Values are inline fields in their rows with the shared
  [replace-on-focus](../standards/number-fields.md) behavior; on
  iOS an input accessory offers ‹ › and "Klaar". A deep link focuses its field.
- A value's kind (minimum, maximum, range) is a row menu under its name, also
  holding remove; long press opens it; swipe reveals only remove.
- Presets and "remove all" apply directly with undo, since nothing saves until ✓.
  A preset is one row with its source and the number of values changed since.
- Unset items stay listed in their own section with +; adding fills the default
  and focuses it.

## States

Header and period strip stay in every state so other periods remain reachable.
Pending sync is one line above the summary; an empty period has one action that
opens its first day.

## Invariants

- Diary Entries are snapshots; editing a source Food does not change history.
- Missing nutrient values are not zero.
- A Logged Combo and its Diary Entries are never counted twice.
- Capture Drafts are not intake. Saved drafts are account-owned
  ([ADR 0014](../adr/0014-online-first-account-data.md)).

## Out of scope

AI parsing of a note into entries; blocking Complete Day on drafts.

## Acceptance

iOS first in English/Dutch, light/dark, and larger text; Android keeps working
through adapters. Evidence: [diary redesign](../records/2026-10-06-nutrition-diary/README.md),
[nutrition prototype](../records/2026-09-20-nutrition-prototype/README.md).
