# Mobile nutrition interactions

Approved product behavior extracted from the mobile design studies. These choices
remain local because they define Workouts tasks, actions, and domain consequences.
They do not establish implementation completion. Consult [verification evidence](../verification/README.md)
and the current component API before implementing a study.
Reusable interactions come from the shared [patterns](../guidelines/shared/patterns/README.md);
[mobile design](../../apps/mobile/DESIGN_SYSTEM.md) owns brand and component bindings.

Settled in the nutrition diary study ([approved study](../../designs/nutrition/diary_final.html)).


- **Header.** Tab roots use the native large title, which collapses into the
  inline title on scroll. Use `headerLargeTitleEnabled` and `headerTransparent`
  on iOS. Screen actions sit top-right as at most two toolbar items: one direct
  action (for example the calendar) plus a ⋯ menu. The ⋯ menu keeps every action
  the screen already had; a redesign removes actions only deliberately.
- **Rows.** Diary row tap opens the editor. Use the shared actionable-list
  contract and the platform bindings in the mobile design system.
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

Settled in the log food study ([approved study](../../designs/nutrition/log_final.html)).

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

Settled in the weekly overview study ([approved study](../../designs/nutrition/week_final.html)).

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

Settled in the goals editor study ([approved study](../../designs/nutrition/goals_final.html)).

- **Draft editor sheet.** Goals bind the shared editor contract to `formSheet`
  with ✕/✓ via `Stack.Toolbar`, `usePreventRemove`, and `useConfirm()`.
  The draft locks during save and failures use the existing retry toast.
- **The number is the field.** Numeric values are inline fields in their rows,
  not separate screens. Apply the shared [replace-on-focus contract](../guidelines/shared/patterns/number-fields.md). Bind the shared replace-on-focus variant to `InlineNumberFieldRow`;
  the current component has no `replaceOnFocus` prop, so this remains an
  implementation requirement of the approved study. On iOS an `InputAccessoryView` offers ‹ › between fields and
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

Settled in the personal food study ([approved study](../../designs/nutrition/personal-food_final.html)).


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

Settled in the food library study ([approved study](../../designs/nutrition/library_final.html)).

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

Settled in the combo editor study ([approved study](../../designs/nutrition/combo_final.html)).

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

Settled in the my-measures study ([approved study](../../designs/nutrition/measures_final.html)).

- **Group by compatibility.** When an item only applies where its unit matches
  (g or ml), list one section per unit with the rule as the section footer, not
  one mixed list with an explanatory note. Each section has its own + in the
  section header, which presets the unit; order is kept per section.
- **Small values edit in the serving popup.** A saved value with a name and an
  amount (a personal measure) is added and changed in the shared serving popup
  above the keyboard, with the unit as its segment, not in a form screen or
  sheet. Changing the unit of an existing value asks first.
- **Order without a mode.** Move up/down sit in the long-press menu (disabled at
  the edges), never as buttons on every row.

Settled in the one-off log study ([approved study](../../designs/nutrition/one-off_final.html)).

- **Same composition as the library editor.** A form that captures food without
  saving it (a One-off Entry) reuses the personal food editor: photo and name as
  the hero, the amount where the editor has servings, then all eight nutrients
  with the basis menu and the same field and keyboard rules. Leave out what does
  not apply (details, the estimated switch: one-offs are always estimated).
- **Basis defaults to what you ate.** Values default to the whole amount
  ("voor 1 portie"); per 100 g/ml stays in the basis menu and shows the total
  below. The snapshot stores totals.
- **Destination as the sheet subtitle.** A ✕/✓ sheet that logs shows its task as
  the title and the meal + day below it as the destination menu from Log food.
- **Photo popup.** Tapping a food photo opens one menu: Take photo, Choose photo,
  Icon › (a submenu with the presets, current one shown beside it), and Remove
  photo only when there is a photo. Every food editor uses this popup instead of
  listing the presets in the main menu.
- **Switching kind keeps input.** The Personal food / Recipe / One-off segment
  carries the name and photo to the other form.
