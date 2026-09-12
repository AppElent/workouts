# Release 3 goals/history checkpoint

## Scope completed

- Versioned nutrition goals backend with legacy-compatible `list`, dated `forDate`, and dated `replace`.
- Frozen legacy reference goals before the first effective version; future versions are not included in today’s list.
- Goals/history screen with effective-date editing, presets, bounds, preview, bilingual local copy, dirty-draft protection, and validation.
- Goals screen also distinguishes stalled offline loading with localized retry affordance and prevents duplicate in-flight saves.
- Reusable calendar with an actual month grid, leap-day handling, previous/next month navigation, Today, and accessible date controls.

## Parent integration contract

- Keep spreading `nutritionGoalTables` from `convex/nutritionGoalTables.ts` in `convex/schema.ts`.
- `api.nutritionGoals.forDate({ date })` returns exactly:

  ```ts
  {
    goals: NutritionGoal[],
    basis: "effective" | "reference",
    effectiveFrom: string | null,
  }
  ```

- `list({})` remains the legacy current-goals array and only resolves versions effective on or before server UTC today.
- Do not change `nutrition-day.ts` or `nutrition-day.tsx`; the day integration should consume the `forDate` envelope above.
- Calendar import path: `apps/mobile/src/ui/nutrition-calendar.tsx`.
  Required props are `selectedDate: IsoDate` and `onSelect(date: IsoDate)`; optional props are `locale`, `today`, and accessible-label overrides.

## Owned paths

- `convex/nutritionGoalTables.ts`
- `convex/nutritionGoalModel.ts`
- `convex/nutritionGoals.ts`
- `convex/nutritionGoals.test.ts`
- `apps/mobile/src/data/nutrition-goal-history.ts`
- `apps/mobile/src/data/nutrition-goal-history.test.ts`
- `apps/mobile/src/data/nutrition-goals-copy.ts`
- `apps/mobile/src/ui/nutrition-calendar.tsx`
- `apps/mobile/src/ui/nutrition-calendar.test.tsx`
- `apps/mobile/src/screens/nutrition-goals.tsx`
- `apps/mobile/src/screens/nutrition-goals.test.tsx`
- `apps/mobile/src/i18n/language.test.tsx` (Dutch validation assertion)

## Verification

- Focused mobile tests: 4 suites, 17 tests passed.
- Goals screen focused tests: 1 suite, 5 tests passed.
- Convex goals tests: 7 tests passed.
- Root typecheck: passed.
- Mobile typecheck: passed.
- Owned-path Biome check: passed, including the final offline/save-guard files.
- No emulator or visual QA run, per task scope.
