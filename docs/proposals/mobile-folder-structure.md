# Mobile folder structure

Proposed standard. Apply after agreement; existing code is not yet migrated.

## Ownership

- `apps/mobile/app/`: routes, parameter validation, navigation, and presentation.
- `apps/mobile/src/features/<feature>/`: feature screens, state, and supporting code.
- `features/nutrition/components/`: components shared across nutrition subjects.
- `src/ui/`: app-wide, domain-independent controls and platform adapters.
- Existing data services remain canonical; reuse their operations. Shared domain
  calculations and catalogs stay in `packages/core/`.

Keep each subject folder flat while it remains easy to navigate. View, editor,
and their supporting components live together. Add subfolders when size warrants
them, not merely because tasks or presentations differ.

```text
src/
  ui/
    segmented.tsx
  features/nutrition/
    components/
      meal-picker.tsx
      nutrient-table.tsx
    personal-food/
      personal-food-editor-form.tsx
      personal-food-editor-form.test.tsx
      personal-food-editor-screen.tsx
      personal-food-editor-sheet.tsx
      personal-food-header.tsx
      personal-food-view-content.tsx
      personal-food-view-screen.tsx
      personal-food-view-sheet.tsx
      use-personal-food-editor.ts
```

## Naming and reuse

- Use kebab-case: `<subject>-<task>-<role>`. Shared subject components omit the
  task, such as `personal-food-header.tsx`. Avoid vague names like `helpers.ts`.
- Match component exports to filenames in PascalCase. Hooks use `use-` filenames
  and `use` exports. Tests and platform variants retain the complete basename.
- Colocate supporting components, hooks, and tests with their screens. Move UI to
  `nutrition/components/` when another nutrition subject needs the same contract.
- Domain-aware UI stays in its feature: `MealPicker` can wrap the generic
  `Segmented` control. Use `src/ui/` for generic primitives, without a nutrition
  subfolder. Generic UI must not import features.

## View, edit, page, and sheet

- View and edit are separate tasks. Viewing reads saved data; editing owns a
  draft, validation, and save. Cancel discards the draft.
- Page and sheet are presentations. If content and behavior match, reuse one
  screen and configure presentation in the navigator.
- Create separate screen/sheet wrappers only when their composition differs.
  Share content or form components; wrappers own navigation and dismissal.
- Instantiate draft state once per editing session. Preserve it when switching
  presentation; calling the same hook twice does not share state.
- Use routed sheets for navigable tasks and local sheets for auxiliary controls.
  Give scrolling, keyboard handling, safe areas, and chrome one owner. Apply the
  same unsaved-change policy to close, swipe dismissal, and Android Back.

