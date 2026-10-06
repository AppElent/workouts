# Nutrition Diary redesign

Status: implementation delivered in the working tree; automated checks pass.
Partial iOS evidence and remaining visual acceptance are recorded in the
[implementation report](../verification/nutrition-diary/README.md).

## Confirmed direction

- Implement the selected `designs/nutrition/diary_final.html` closely, including its interactive states. The reference currently exists in the main working directory, `/Users/ericjansen/Developer/workouts`, but is absent from the local committed main tree.
- Replace everyday mobile screens and route into the redesign through live navigation. This delivery is not Labs-only.
- Adopt the current [mobile folder contract](../guidelines/project/mobile-folder-structure.md) for new or changed mobile feature code. The previously proposed path is no longer present. Keep routes responsible for navigation and presentation, feature subjects responsible for their screens and state, and canonical services/core responsible for persistence and domain calculations.
- Reuse the first Diary Entry redesign and its established components where their contracts match. Its live promotion also needs to replace its Labs-only food-detail destination.
- Produce an implementation report describing created/moved files, their owners and placement rationale, reference fidelity, verification evidence, and remaining limitations.

## Reference coverage

The selected board specifies a collapsing native diary header and date navigation; row tap, swipe, and context-menu actions; Meal Slot title menus; selection and copy/move presentation; daily Nutrition Goals; nutrient-source rankings; and incomplete/no-goal states.

HTML example code is illustrative. Existing durable batch operations take precedence over its older per-entry transfer sketch. Reference phone chrome is supplied by the native app.

## Interview decisions

- Retain the app calendar with logged-day indicators, styled close to the reference.
- Limit batch intake actions to Diary Entries. Preserve Capture Draft edit/process/delete actions and exclude Capture Drafts from intake totals.
- Target iOS-first acceptance, including English/Dutch, light/dark, and larger text. Preserve Android functionality through platform adapters and report unverified behavior.
- “Aanvullen” updates the source Food and only the tapped Diary Entry. Other entries remain unchanged, including entries for the same Food on the same date. An ordinary source Food edit still does not update history. For Shipped Foods, source correction follows the existing Fork behavior.
- Apply only nutrient fields explicitly changed in that correction to the tapped Diary Entry, scaled to its logged quantity. Preserve other saved nutrient figures rather than refreshing the entire snapshot from current source data. See [the correction decision](../adr/0011-explicit-nutrient-correction-from-diary.md).

- If no source Food exists, correct only the tapped Diary Entry, explain the scope, and do not create a Personal Food automatically.
- The user confirmed the complete scope and this exception before implementation.
- Supporting UI lives in subject-local `components/` folders; screens and state
  hooks remain at the subject root. Shared nutrition UI stays in
  `features/nutrition/components/`.

## Domain constraints

[CONTEXT.md](../../CONTEXT.md) remains the sole domain glossary. Diary Entries are historical snapshots; editing their source Food does not update history. Capture Drafts do not count as intake. Missing nutrient values are not zero. A Logged Combo and its underlying Diary Entries must not be counted twice.

Explicit correction of a selected snapshot is distinct from automatically following later source changes. This boundary is recorded in ADR 0011; the Diary Entry glossary definition states that explicit correction is allowed.
