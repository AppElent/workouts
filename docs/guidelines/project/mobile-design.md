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

Native navigation actions use the platform's semantic button style. For a dirty
save/confirmation action on iOS 26+, use a native prominent bar item with
`accentFill`; UIKit owns the filled shape and glass. A clean save is plain and
disabled, invalid or conflicting work disables saving, and pending work shows
progress with duplicate submission blocked. Keep an accessible action name.
The [Diary Entry editor](../../../apps/mobile/src/features/nutrition/diary-entry/diary-entry-editor-screen.tsx)
is the current example; use the platform fallback on other supported targets.
Review the complete toolbar composition: a custom content background inside a
system glass item can create mismatched nested shapes.

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

When implementing a supplied design or mockup, use the verification guide's
[reference-comparison workflow](../../../.claude/skills/verify/SKILL.md#implementing-a-supplied-design).

## Diary Entry redesign

The first adoption of [the feature folder structure](mobile-folder-structure.md)
began with the Labs editor in spec #91 and is now used by the live Diary Entry route. Its quantity capsule, serving/menu
pills, native sheet actions, combined product/nutrient card, and keyboard accessory
follow [Round 5](../../../designs/entry-editor/round5.html). These are deliberate
exceptions to the older form/primary-button and pill composition above, not a
restyling instruction for other screens.

`GlassSurface` owns material rendering; `SelectionMenu` owns platform selection.
The feature owns the quantity interaction and creation popup. The popup keeps
both visible native text inputs in a keyboard-avoiding overlay within the sheet.
SwiftUI hosts must stay outside `InputAccessoryView`: moving them into UIKit's
keyboard window crashes the installed native runtime. The overlay preserves the
glass surface, native scope picker, and editable caret/selection controls. See the
[implementation report](../../verification/diary-entry-editor/README.md)
for verified transitions and remaining native acceptance.

The Round 5 editor opts into `type.quantityCompact` (44pt) and `type.table`
(14pt), approved for this slice; existing type variants remain unchanged.
Its content uses 84pt circular step buttons and a compact nutrition table, while
menus retain native iOS spacing and styling. Both quantity shortcuts and serving
creation use the feature-owned keyboard overlay. Keep its keyboard observer
mounted before focus so the shortcut bar receives the opening keyboard event.
