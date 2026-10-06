# Workouts mobile design system

The app is an iOS-first fitness utility: energetic when progress matters, calm
while entering data, and dense enough for repeated daily use. The lime accent
identifies the primary action, selection, and progress. Neutral surfaces carry
everything else.

## Shared behavior

Read the root [design system](../../../DESIGN_SYSTEM.md) and its general/mobile/
iOS/Android links for the screen contract, states, navigation, and verification
rules. The sections below define Workouts' visual identity and component seams.

## Layers

### Functional chrome

On iOS, navigation and transient controls use the operating system: native tab
bars, stack headers and toolbars, menus, form sheets, context menus, pickers,
and SF Symbols. iOS 26 supplies Liquid Glass to this layer. Let the system own
its material and motion instead of imitating it in React Native.

### Content

Content uses opaque semantic surfaces from `apps/mobile/src/theme/tokens.ts`. Group related
rows with separators. Cards represent actual objects or summaries; they are not
containers for arbitrary form fields. A repeated object is a compact summary
row and opens focused editing when necessary.

## Interfaces

`apps/mobile/src/ui/form.tsx` is the design-system seam for data entry and grouped content:

| Interface | Use |
| --- | --- |
| `FormScreen` | Keyboard-aware scrolling plus one safe-area primary action |
| `FormSection` | Related rows with a heading, separators, and optional help |
| `GroupedSurface` | A composed summary that must remain one visual object |
| `FormTextField` | Labeled text entry with semantic error placement |
| `InlineNumberFieldRow` | Compact numerical entry with unit and accessory |
| `DisclosureRow` | Progressive disclosure or navigation to more detail |
| `EditableValueRow` | A saved repeated value summarized in one row |
| `AddRow` | Add an item inside the section it affects |
| `StepperField` | Small bounded numeric adjustment with a 44-point hit area |
| `TextAction` | Cancel, neutral, or destructive secondary action |

Primary actions use `PrimaryButton`. `GhostButton` remains a compatibility
primitive for unmigrated screens, not the default for disclosures, additions,
cancellation, deletion, or navigation.

## Visual grammar

- Use the system font and the named type ramp in `apps/mobile/src/theme/tokens.ts`.
- Use one lime accent. Destructive actions use the semantic danger color.
- Use the 4-point spacing scale. Space between sections is larger than space
  between related rows.
- Use continuous corners. Pills are reserved for the principal action and
  compact chips, not every tappable element.
- Keep visible controls compact while maintaining at least 44-point iOS and
  48dp shared hit regions.
- Prefer short action labels whose context comes from the screen title.

## Interaction patterns

Settled in the nutrition diary study (`designs/nutrition/diary_final.html`).
Apply them to other list-based screens unless a screen-specific design says otherwise.

- **Header.** Tab roots use the native large title, which collapses into the
  inline title on scroll. Use `headerLargeTitleEnabled` and `headerTransparent`
  on iOS. Screen actions sit top-right as at most two toolbar items: one direct
  action (for example the calendar) plus a ⋯ menu. The ⋯ menu keeps every action
  the screen already had; a redesign removes actions only deliberately.
- **Rows.** Tap opens the editor. Swipe reveals at most two frequent actions
  (edit, delete) and never commits on a full swipe. Long press opens the full
  action set as a context menu with a lifted preview. On iOS, use
  `InsetList`/`InsetRow` `actions` (`swipe: false` keeps an action out of the
  swipe); Android keeps `SwipeableRow`. Every action also has a visible route.
- **Section menus.** When each section (for example a meal) needs actions, its
  title becomes the menu trigger (`Title ⌄`). Do not add a ⋯ next to the section's
  add button; empty sections have no menu.
- **Selection.** Selection mode is the bulk route. The large title shows the
  count, each section has an "All" toggle, the tab bar gives way to a bottom
  toolbar, and "Done" exits. Long press → Select enters it with that row selected.
- **Destination picker.** Copy and move share one sheet. The verb (segmented)
  comes first and sets the title, then nearby days as tiles with a calendar
  tile for any other date, then the target section, then a preview of the impact.
- **Summaries.** A compact summary card shows the leading numbers and one row
  that opens the full set ("All goals", with the worst status as a badge). In
  the full view, tapping a figure shows its sources ranked by contribution and
  its split per section; tapping a source opens that item's editor. Incomplete
  totals (`≥`) list the items without a value first, each with an action to
  fill it in; approximate totals (`~`) say so. Ranking is a pure function in
  `@workouts/core`.

Settled in the log food study (`designs/nutrition/log_final.html`). Apply them to
other pushed find-and-add screens.

- **Bottom search.** A pushed screen without a tab bar puts search and its
  companion actions in the system bottom toolbar on iOS 26+: `Stack.SearchBar`
  plus `Stack.Toolbar placement="bottom"` with `Stack.Toolbar.Menu` (+),
  `SearchBarSlot`, and at most two `Button`s. The system expands the field above
  the keyboard; do not build a custom glass capsule. iOS < 26 and Android keep an
  in-content search row with the same actions.
- **Destination title.** When a screen writes into one target (meal + day), the
  inline title is the target menu (`Lunch ⌄`, day as subtitle); the calendar
  stays as the one direct toolbar action.
- **Quick add.** A row's + commits immediately with the remembered amount,
  confirms with a toast that offers undo, and updates the target's summary in
  place. The summary expands to the logged items with the diary row contract.
  Prefer this to a basket or selection mode for adding.
- **Provider search.** A rate-limited third-party catalogue (Open Food Facts)
  is its own results section below local results, present whenever there is a
  query. Query it only for a settled term (the keyboard search key, or 1.5 s idle
  with ≥ 3 characters), cache first, within an app-side budget below the
  provider's documented limit. On rate limiting only that section waits and
  retries; local results are unaffected.

Settled in the weekly overview study (`designs/nutrition/week_final.html`). Apply
them to other period reviews (a week or month of days).

- **Period header.** A pushed review keeps the large title, named for the period
  ("Deze week", "Vorige week", "Week 38") with the date range below. A period
  strip mirrors the diary day strip: recent periods as chips with logged-day
  dots, swipe for older ones, ending at the current period; the calendar is the
  direct toolbar action and selects a whole period. No prev/next buttons.
- **Period summary.** One summary card: the leading nutrient per day as SVG bars
  (`react-native-svg`, one `Pressable` per day) with the goal band, the other
  goals as one row of status squares per day (fill, outline, dash, not colour
  alone), and "Alle doelen" with the worst miss as a badge. Figures show the
  average plus "x of y days" within goal. The diary summary → sources route
  applies across days: bars open that day's sources, sources that occur on
  several days ask which day before opening the entry editor.
- **Goals over time.** Compare each day with the goal that applied then. A goal
  change inside the period steps the band on that day and adds one line naming
  the change. Days before the first goal are neutral, without status, and do not
  count in "x of y days"; averages of logged values are unaffected.
- **Day rows in a review.** Tap opens the day in the diary. Long press offers the
  day actions (open, that day's goals, copy the day); no swipe and no selection
  mode when there are no frequent or bulk actions.
- **Review states.** Header and period strip stay in every state, so another
  period stays reachable offline. Pending sync is one line above the summary,
  not a card; an empty period has one action that opens its first day.

Settled in the goals editor study (`designs/nutrition/goals_final.html`). Apply
them to other screens that edit a set of saved values as one draft.

- **Draft editor sheet.** Editing a saved set opens a `formSheet` with ✕ (left)
  and ✓ (right) via `Stack.Toolbar`. ✓ is disabled until the draft changes.
  Leaving with changes (✕ or swipe down) asks to discard via `usePreventRemove`
  plus `useConfirm()`. While saving, ✓ shows progress and the fields lock; a
  failed save keeps the sheet and the draft open with a retry toast.
- **The number is the field.** Numeric values are inline fields in their rows,
  not separate screens. On focus the current value turns grey (it becomes the
  placeholder) and the first key replaces it; leaving without typing, or after
  clearing, keeps the old value. Use `InlineNumberFieldRow` with
  `replaceOnFocus`. On iOS an `InputAccessoryView` offers ‹ › between fields and
  "Klaar". A deep link to one value opens with that field focused.
- **Kind as a row menu.** When a value has a kind (minimum, maximum, range), the
  kind is a menu label under the row name; the menu also holds "remove". Long
  press opens the same menu; swipe reveals only remove. Rows with text fields use
  `SwipeableRow`, not `InsetList`.
- **Draft-wide actions.** Replacing or clearing the whole draft (a preset,
  "remove all") applies directly with an undo toast instead of a confirmation,
  because nothing is saved until ✓. A preset shows as one row with its source
  and the number of values changed since, with a menu to switch or restore it.
- **Unset items stay visible.** Items without a value are listed in their own
  section with +; adding fills the default (for example the reference value)
  and focuses it with the replace-on-focus behaviour.

Settled in the personal food study (`designs/nutrition/personal-food_final.html`).
Apply them to other editors of a saved library object (recipes, combos).

- **One editor, three presentations.** Editing an existing object pushes it
  (from a list). Creating a new one is a `formSheet` with ✕/✓. Opened from a
  row inside a sheet (a diary entry), it pushes from the right inside that
  sheet through a nested `Stack`; ‹ returns to the row. The header is ⋯ plus
  ✓; the photo and name are the large title and collapse into the inline title.
- **Source of a snapshot.** A snapshot (a diary entry) shows its source as a
  disclosure row. Editing the source from there offers "also update this
  entry", on by default and with its effect shown; other snapshots keep their
  values.
- **Choices before values.** Sections the user picks from when logging
  (servings) sit above the reference values (nutrition). The basis of the values
  is the section menu (`per 100 g ⌄`), not a segmented control.
- **One serving component.** Adding or editing a serving anywhere uses the
  serving popup above the keyboard from the entry editor, with the
  replace-on-focus rule for its name and amount. Rows swipe to delete only; long
  press adds "move to top" (the logging default).
- **Provider refresh into the draft.** Refreshing an imported object from its
  provider (Open Food Facts) writes the new values into the open draft, marks
  each changed row with "was …", and saves with ✓. When the user edited values
  themselves, ask before overwriting; declining refreshes only the provider
  metadata.
- **Trace and unknown.** Values that can be "trace" or "unknown" offer both
  above the decimal keyboard, next to ‹ ›, instead of a menu per row.

Settled in the food library study (`designs/nutrition/library_final.html`). Apply
them to other libraries of the user's own objects.

- **One list, sections per kind.** A library is one `SectionList` with a section
  per kind (Voeding, Recepten, Combo's) showing the first items and "Toon alle".
  Scope chips filter the same screen; "Toon alle" selects its kind's chip instead
  of pushing a screen. Rows show the value, its basis, and the source tag
  (OFF, NEVO, ~ estimated, ⚠ needs attention). An empty section stays with one
  row that says how to fill it, and has no section menu.
- **Library search is local.** Search filters on every keystroke and groups
  results per kind. A third-party provider is only a link below the results;
  importing is a deliberate step. Find-and-add screens keep the provider section.
- **One status row.** The top of the list holds at most one status row, in the
  order restoring › restore failed › needs attention › offline. "Needs
  attention" opens a sheet listing each problem with the action that fixes it;
  Settings stays the owner of backup and provider refresh, and the ⋯ menu links
  there.
- **Deleting a referenced object.** The confirmation names what references it
  (combos) and states that the diary is unchanged. Confirm with a toast; no undo
  when the backup commits the removal immediately.

Settled in the combo editor study (`designs/nutrition/combo_final.html`). Apply
them to other composite objects and to every amount task.

- **Composite objects edit in place.** A composite (combo) has no edit mode or
  Save: each confirmed part change is saved at once. Parts use the diary row
  contract; long press adds replace and Omhoog/Omlaag so order needs no drag
  mode. Logging is the first ⋯ item. A part whose source is gone keeps its
  snapshot, so totals stay exact; only logging waits until it is replaced,
  removed, or turned off for that log.
- **One amount editor.** Every amount task uses the Diary Entry editor
  composition (quantity capsule, serving menu, product + nutrient card, bottom
  toolbar): editing a diary entry, a combo part, logging a combo, and "only this
  time" adjustments. Only the title, the first table column, and the toolbar
  differ (meal/date for logging, replace/remove for a part, none for a one-off
  adjustment). Rescale from the stored snapshot, not the live source. Do not add
  a separate reset action; closing without ✓ discards.
- **Browser target modes.** Adding to or replacing in a composite, and saving a
  provider result to the library, reuse the food browser with a narrow target
  mode (title "Toevoegen"/"Vervangen"; + writes to the target) instead of a
  second browser.

## Device acceptance

Verify each affected supported platform with the development build. A simulator
can verify layout and navigation; final iOS feel/haptics acceptance requires a
physical iPhone. Follow [the project verification guide](../../../.claude/skills/verify/SKILL.md)
and state unavailable platforms explicitly. For visual changes capture the populated
screen and verify:

- Dutch and English copy;
- Dynamic Type XL;
- keyboard open and interactive dismissal;
- safe areas, native header, tab bar, and sheet grabber;
- disabled, pending, validation-error, and storage/network-error states;
- a short recording when navigation, sheets, gestures, or motion changed.

Automated tests protect behavior; they do not approve hierarchy or device feel.
