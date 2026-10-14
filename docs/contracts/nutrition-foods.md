---
type: contract
description: Read when changing the food library, Personal Foods, Recipes, Nutrition Estimates, Combos, or Personal Measures.
version: 1.0.0
status: current
---

# Nutrition foods

A person keeps reusable foods, recipes, combos, and measures so logging stays fast.
Studies: [personal food](../../designs/nutrition/personal-food_final.html),
[library](../../designs/nutrition/library_final.html),
[combo](../../designs/nutrition/combo_final.html),
[measures](../../designs/nutrition/measures_final.html),
[label scanning](../../designs/nutrition/ai-entry_final.html).

## Model

- Personal Food is the one reusable-food record. Recipe is a classification of it,
  with no separate persistence or identity.
- Nutrition Estimate is independent of classification and provenance; manual entry
  is not automatically estimated. AI or assisted proposals are reviewed before save
  or log.
- Nutrition is per 100 g/ml or per serving, so estimates never need a fabricated
  weight.
- Diary snapshots keep estimate status; later Food edits affect future logs only.
  Estimated entries show a compact icon with an accessible label, no badge or
  day-total warning.
- Combos reference Foods; logging resolves current figures and freezes the
  resulting Diary Entries.
- Food photos are device-only; records keep a portable preset icon
  ([ADR 0014](../adr/0014-online-first-account-data.md)).

## Behavior

### Food editor

- **Presentations.** Editing an existing food pushes it; creating is a `formSheet`
  with ✕/✓; opened from a row inside a sheet it pushes within that sheet's stack
  and ‹ returns. Header: ⋯ plus ✓; photo and name form the collapsing large title.
- **Source of a snapshot.** A Diary Entry shows its source as a disclosure row.
  Editing the source from there offers "also update this entry", on by default
  with its effect shown; other snapshots keep their values.
- **Choices before values.** Servings sit above nutrition. The basis is the
  section menu (`per 100 g ⌄`), not a segmented control.
- **Servings.** Added and edited in the shared Serving popup. Rows swipe to delete
  only; long press adds "move to top" (the logging default).
- **Provider refresh.** Refreshing from Open Food Facts writes into the open
  draft, marks changed rows "was …", and saves with ✓. If the person edited
  values, ask first; declining refreshes only provider metadata.
- **Trace and unknown.** Offered above the decimal keyboard beside ‹ ›.
- **Photo popup.** Take photo, Choose photo, Icon › (presets, current shown), and
  Remove photo when one exists. Every food editor uses it.

### Label scanning

- **One entry, three places.** A full-width "Etiket scannen" row above Voedingswaarde
  in the food editor, on an Open Food Facts product with missing values, and as the
  primary action when a scanned barcode is unknown. Own camera screen with a frame
  guide (`expo-camera`) and the photo library.
- **What it fills.** Name, brand, barcode, net quantity, per-100 values, and up to
  three Servings with everyday names derived from the label ("Portie (½ zak)",
  "1 reep", "Hele verpakking"). Filled fields are marked "uit etiket"; nothing
  saves until ✓.
- **Never overwrite.** A scan only fills empty values; existing values (typed
  or from a provider) stay, and differing ones are listed. Failed energy,
  kJ/kcal, saturated ≤ fat, sugars ≤ carbs, unreadable-EAN, or other-product-EAN
  checks are shown with "Opnieuw scannen".

### Library

- One `SectionList` with a section per kind (Voeding, Recepten, Combo's) showing
  the first items and "Toon alle", which selects that kind's scope chip. Rows show
  value, basis, and source tag (OFF, NEVO, ~ estimated, ⚠ needs attention). An
  empty section keeps one row explaining how to fill it and has no menu.
- Search is local, filters per keystroke, and groups per kind. A provider is only
  a link below results; importing is deliberate.
- At most one status row on top: restoring › restore failed › needs attention ›
  offline. "Needs attention" opens a sheet listing each problem with its fix.
- Deleting a referenced object names its references (Combos) and states the diary
  is unchanged. Confirm with a toast; no undo.

### Combos

- Edit in place: no edit mode or Save; each confirmed part change saves. Parts use
  the diary row contract; long press adds replace and Omhoog/Omlaag. Logging is
  the first ⋯ item.
- A part whose source is gone keeps its snapshot so totals stay exact; only
  logging waits until it is replaced, removed, or turned off for that log.
- Amounts use the shared [amount editor](nutrition-logging.md#amount-editor).

### Personal Measures

- One section per unit (g, ml) with the compatibility rule as footer; each section
  header has + presetting its unit; order is per section.
- Added and changed in the Serving popup; changing an existing unit asks first.
- Move up/down live in the long-press menu, disabled at the edges.

## Acceptance

Estimate, classification, and basis survive every create, edit, copy, move, Combo,
and account round trip. Evidence:
[personal food implementation](../records/2026-09-16-personal-food-recipes-estimates.md),
[nutrition prototype](../records/2026-09-20-nutrition-prototype/README.md).
