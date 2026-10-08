# Foundry mobile design system

## Identity

Foundry is an iOS-first fitness utility: energetic for progress, calm for data
entry, and compact for daily use. The lime accent identifies primary actions,
selection, and progress. Opaque neutral surfaces carry content; native chrome
owns system materials. `src/theme/tokens.ts` owns the system type ramp, 4-point
spacing scale, semantic colors, and corners.

Pills identify principal actions and compact chips. Cards represent objects or
summaries; grouped fields use rows and separators. The approved Profile study
permits fixed-tint icon tiles for settings, an exception to the single lime accent.

## Adopted patterns

| Task | Shared contract | Workouts binding |
| --- | --- | --- |
| Numeric input | [Number fields](../../docs/guidelines/shared/patterns/number-fields.md) | InlineNumberFieldRow for rows; Diary Entry quantity composition for amount tasks. Goals study selects replace-on-focus; the existing component has no such prop yet. |
| Editing | [Editor presentations](../../docs/guidelines/shared/patterns/editors.md) | Native Stack screens/formSheet; serving creation uses the Diary Entry keyboard overlay. |
| Row actions | [Actionable lists](../../docs/guidelines/shared/patterns/lists.md) | InsetList/InsetRow on iOS; SwipeableRow on Android and text-input rows. Product contracts select the tap action. |

`src/ui/form.tsx` is the design-system seam for data entry and grouped content:

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

On iOS 26+, dirty Save uses the native prominent toolbar item with `accentFill`;
clean Save is plain and disabled. Native chrome owns its shape/material. The
[Diary Entry screen](src/features/nutrition/diary-entry/diary-entry-editor-screen.tsx)
is the current binding; preserve platform fallbacks.

## Product flows

Read only the affected contract:

- [Nutrition](../../docs/product/mobile-nutrition.md): diary, food search, goals,
  library, composite amounts, measures, and one-off logging.
- [Training](../../docs/product/mobile-training.md): routines and start activity.
- [Profile](../../docs/product/mobile-profile.md): account, settings, and summaries.

## Diary Entry exception

The [Round 5 study](../../designs/entry-editor/round5.html) selects the quantity
capsule, serving/menu pills, combined product/nutrient card, and keyboard accessory.
Its 84pt circular step controls, `type.quantityCompact` (44pt), and `type.table`
(14pt) are scoped to this editor; other screens retain the shared form composition.
`GlassSurface` owns material, `SelectionMenu` platform selection, and the feature
owns quantity interaction and serving creation.

The installed runtime crashes when SwiftUI hosts enter `InputAccessoryView`'s
keyboard window. Keep those hosts in the keyboard-avoiding overlay inside the
sheet, with the keyboard observer mounted before focus. This is a runtime-specific
workaround, not a general popup restriction. See the [observed evidence](../../docs/verification/diary-entry-editor/README.md).

Use [project verification](../../docs/runbooks/verification.md) for current checks
and pending device acceptance. Design studies alone do not certify native behavior.
