---
type: contract
description: Read when changing Log food, the Diary Entry editor, Servings, or One-off Entries.
version: 1.0.0
status: current
---

# Nutrition logging

A person finds a food, sets an exact amount, and logs it to a Meal Slot and day.
Studies: [log food](../../designs/nutrition/log_final.html),
[entry editor round 5](../../designs/entry-editor/round5.html),
[one-off](../../designs/nutrition/one-off_final.html),
[AI entry](../../designs/nutrition/ai-entry_final.html).

## Behavior

### Log food

- **Bottom search.** A pushed screen without a tab bar puts search and companion
  actions in the iOS 26+ bottom toolbar: `Stack.SearchBar` plus
  `Stack.Toolbar placement="bottom"` with a `Stack.Toolbar.Menu` (+),
  `SearchBarSlot`, and at most two buttons. No custom glass capsule. iOS < 26 and
  Android keep an in-content search row with the same actions.
- **Destination title.** The inline title is the target menu (`Lunch ⌄`, day as
  subtitle); the calendar is the one direct toolbar action.
- **Quick add.** A row's + logs immediately with the remembered amount, confirms
  with an undo toast, and updates the target summary in place. The summary expands
  to the logged items. Prefer this to a basket or selection mode.
- **Provider search.** Open Food Facts is its own section below local results
  whenever there is a query. Query only a settled term (search key, or 1.5 s idle
  with ≥ 3 characters), cache first, within an app budget below the provider's
  limit. Rate limiting delays only that section.
- **Target modes.** Adding to or replacing in a Combo, and saving a provider result
  to the library, reuse this browser with a narrow target mode ("Toevoegen" /
  "Vervangen"); + writes to the target.

### Amount editor

Every amount task uses one composition: quantity capsule, Serving menu, product +
nutrient card, bottom toolbar. Editing a Diary Entry, a Combo part, logging a
Combo, and one-time adjustments differ only in title, first table column, and
toolbar (meal/date/delete for entries; replace/remove for parts; none for one-time).

- **Quantity.** − and + adjust; typing accepts locale decimals; presets and Done
  sit above the keyboard. The equivalent base amount is shown.
- **Exact amounts.** Switching Serving or unit preserves the exact amount
  (1.25 × 150 ml stays 187.5 ml) without display rounding or drift. Respect each
  food's base unit and conversion metadata; never assume g ↔ ml equivalence.
- **Servings menu.** Groups food Servings, compatible Personal Measures, and the
  base unit. Only unit-compatible measures appear.
- **Feedback.** Nutrition updates live; when editing, the original amount and
  calorie difference are shown. Rescale from the entry's snapshot, never from a
  changed source; label differing source figures.
- **Details.** The product header opens read-only details; the draft survives the
  round trip.
- **Dismissal.** One draft per session. Clean dismissal closes immediately; dirty
  close, swipe, and Back ask to discard; Keep editing returns to the same draft.
  No separate reset action. Pending saves block duplicates and dismissal.
- **Toolbar.** Meal Slot, quick dates plus any date, and confirmed delete.

### New Serving popup

- Opens above the keyboard with name and amount; Next moves to amount; the unit
  is its segment. Also used for Personal Measures and personal-food Servings.
- Confirming saves the definition independently and selects it at quantity one.
  Cancelling the popup creates nothing; cancelling the editor keeps a saved
  definition.
- On a Personal Food, the Serving is embedded in that food. On a Shipped Food, it
  is an account-owned supplementary Serving keyed by the shipped ID: no Fork, no
  Shadowing, shipped nutrition updates still apply. A later Fork copies them once
  ([ADR 0010](../adr/0010-personal-servings-for-shipped-foods.md)).
- Creating, changing, or deleting definitions needs a connection; cached ones
  remain selectable offline, with a clear explanation when creation is unavailable.

### One-off Entry

- Reuses the personal food editor composition: photo and name as hero, amount,
  then all eight nutrients with the basis menu. No details or estimated switch;
  one-offs are always estimated.
- Values default to the whole amount ("voor 1 portie"); per 100 g/ml stays in the
  basis menu with the total below. The snapshot stores totals.
- The sheet title is the task; the meal + day below it is the destination menu.
- The Personal food / Recipe / One-off segment carries name and photo across.

### Hulp bij invoeren (AI entry)

- **One input.** A `formSheet` with task title and the meal + day destination menu.
  Text, camera, or photo library; the AI tells a nutrition label from a meal.
  Replaces the strict text parser and pasted-label modes; manual estimates stay in
  One-off. Entry points: ✨ in Log food (carries the query), Diary ⋯, and
  "Verwerk met hulp" on a Capture Draft (carries the note; logging removes it).
- **Review before anything is saved.** "Wat ik zag" / "Jouw beschrijving" stays on
  top and is editable to re-run. Items are a plain table (name · amount · kcal ›)
  followed by a "Totaal" table; uncertain amounts are orange with ~. Sources live
  in the footer only. A row opens the [amount editor](#amount-editor) with
  Vervangen and delete.
- **Grounding.** The phone searches its Shipped and Personal Foods for each
  item and the AI picks one candidate. With no match the item becomes an AI
  estimate (~ geschat), logged as a One-off. Logged entries keep their Food
  Reference and are estimated. Open Food Facts as a further source is not built yet.
- **Opslaan als.** A menu row above the button: Losse items (default), Combo, or
  Eén item (One-off or Recipe, values per portion). The button label follows it.
- **Label.** A recognised label opens the personal food editor filled from the
  label (see [label scanning](nutrition-foods.md#label-scanning)).
- **Limits.** One-time consent before first use; a per-account daily limit of
  analyses, each allowing one candidate selection. Offline keeps the text and
  retries once connected (notes need a connection too); the limit state offers
  "Opslaan als notitie" and "Zoek zelf". Calls run server-side.
- **Units.** A matched food counts in its own base unit: an item described in
  ml uses the AI's weight estimate for a per-gram food, and per-ml foods are
  only offered for amounts described as a volume.

## States

Pending, disabled, validation, network failure, and unavailable-source states are
designed. Invalid input and failed saves keep the draft. An entry whose source is
gone stays editable from its snapshot; source-dependent actions explain why they
are unavailable. Missing nutrients are never zero.

## Out of scope

Offline write queues for Servings or Personal Measures; editing the shipped
catalog; a general Serving-management screen.

## Acceptance

Diary saves require a connection ([ADR 0014](../adr/0014-online-first-account-data.md)).
iOS: both languages and appearances, Dynamic Type XL, real keyboard and accessory
transitions, interactive dismissal. Evidence:
[entry editor](../records/2026-10-04-diary-entry-editor/README.md),
[log food](../records/2026-10-06-log-food/README.md). Original spec: issue #91.
