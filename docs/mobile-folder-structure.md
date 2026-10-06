# Mobile folder structure

Adopted for the live Nutrition Diary and Diary Entry redesigns. New feature work
belongs in the feature folders; migrate existing implementations when changing
their behavior. Routes stay thin and use the production destinations. Labs routes
may remain compatibility aliases, but are not the exclusive home of redesigned
screens. See the [Diary report](reports/nutrition-diary-redesign-implementation.md)
and [first implementation report](reports/diary-entry-editor-implementation.md).

## Ownership

- `apps/mobile/app/`: routes, parameter validation, navigation, and presentation.
- `apps/mobile/src/features/<feature>/`: feature screens, state, and supporting code.
- `features/nutrition/<subject>/components/`: supporting UI used only by that subject.
- `features/nutrition/components/`: components shared across nutrition subjects.
- `src/ui/`: app-wide, domain-independent controls and platform adapters.
- Existing data services remain canonical; reuse their operations. Shared domain
  calculations and catalogs stay in `packages/core/`.

Keep screen/view entry points and their state hooks at the subject root. Put
supporting UI in a subject-local `components/` folder, including platform variants.
Keep directly paired tests beside the screen or component they exercise. Group
subject-wide scenario and integration tests in the subject’s `__tests__/` folder;
their names describe behaviors and do not imply matching implementation files. Pure calculations and
presentation helpers remain beside their owning screen/state unless they form a
separate cohesive module. Do not move a component to the shared nutrition folder
merely because two screens within the same subject use it.

```text
src/
  ui/
    segmented.tsx
  features/nutrition/
    components/                    # shared across nutrition subjects
      nutrient-table.tsx
      nutrition-header-menu.tsx
    diary/
      diary-screen.tsx
      diary-screen.test.tsx
      use-logged-diary-dates.ts
      __tests__/                   # subject-wide scenarios
        diary-navigation.test.tsx
        diary-offline.test.tsx
      components/                  # diary-only supporting UI
        diary-calendar.tsx
        diary-meal-card.tsx
        diary-meal-menu.tsx
        diary-meal-menu.ios.tsx
        diary-summary.tsx
        diary-week-strip.tsx
    diary-entry/
      diary-entry-editor-screen.tsx
      diary-entry-editor-screen.test.tsx
      use-diary-entry-editor.ts
      components/
        diary-entry-quantity.tsx
        diary-entry-serving-popup.tsx
```

## Naming and reuse

- Use kebab-case: `<subject>-<task>-<role>`. Shared subject components omit the
  task, such as `personal-food-header.tsx`. Avoid vague names like `helpers.ts`.
- Match component exports to filenames in PascalCase. Hooks use `use-` filenames
  and `use` exports. Tests and platform variants retain the complete basename.
- Keep supporting components in their subject’s `components/`, hooks at the
  subject root, directly paired tests beside their owner, and scenario tests in
  the subject’s `__tests__/`. Move UI to `nutrition/components/`
  when another nutrition subject needs the same contract.
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


## Automated boundaries

`pnpm check:mobile-architecture` runs through `pnpm check` in CI. It checks:

- Direct imports and re-exports from `src/ui/` into `src/features/`, including
  literal dynamic imports and `require`, resolved with the mobile TypeScript config.
- Kebab-case TypeScript filenames in `src/features/`, retaining platform and
  test suffixes.
- Literal `fontSize` values in feature object properties and JSX attributes;
  use shared typography tokens instead.

Naming and font checks cover adopted feature folders. Legacy screens and existing
UI typography migrate separately; this is not whole-app typography enforcement.
The check is syntactic: indirect dependency chains, computed style values, export
naming, and semantic subject/task/role choices still need review. Tests of the
checker run in the existing scripts test project. Keep any future exception narrow,
justified, and tested rather than disabling the check for a feature.
