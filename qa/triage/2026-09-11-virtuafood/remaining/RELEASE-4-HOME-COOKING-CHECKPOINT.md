# Release 4 — Home cooking and imperfect days

Checkpoint: 2026-09-12

## Contract delivered

- Recipes and capture-later drafts use the separate account-scoped SQLite database `workouts-nutrition-cooking.db`.
- The hub discloses that recipes and drafts are device-only for now; recipe sync is deferred. Diary log operations still use the existing local-first operation service.
- A saved recipe is a named bilingual version with ingredient snapshots, all eight nutrient states, and either a cooked gram yield or number-of-portions yield.
- Recipe logging is one atomic `createBatch` of scaled ingredient snapshots. Scaling uses the exact unrounded yield ratio; each ingredient retains its own absent/trace/value state. The batch group name includes `recipe name · version name`, so the logged version remains identifiable after a recipe is deleted.
- One-off logging is directly available from the hub, supports grams or millilitres, labels the serving `Estimated`/`Geschat`, leaves unknown nutrients absent, and does not save a library record.
- Capture-later drafts persist account/date/meal/note, support edit/delete confirmation, and convert through a prefilled Log once form. Conversion identity is persisted before operation acceptance; accepted operations remove the draft only after local diary acceptance. Same-mounted retry reloads the persisted draft identity before checking for an already accepted operation.
- Combo logging accepts an optional positive finite multiplier for that log only, reformats the scaled bilingual serving amount, preserves missing nutrient states, and uses `mintNutritionUuid()` for all new identities.

## Parent integration contract

Route: `/nutrition-cooking`, implemented by `apps/mobile/src/screens/nutrition-cooking.tsx` and `apps/mobile/app/(app)/nutrition-cooking.tsx`.

The diary can open it with:

```ts
router.push({
  pathname: "/nutrition-cooking",
  params: { date, meal },
});
```

The route component export is `NutritionCookingScreen`; register the Stack route/title in the parent-owned layout as needed. No shared layout, diary, browser, schema, operation service, or global i18n file was changed for this slice.

## Boundaries

Photo capture remains deferred. Recipe cloud sync remains deferred. No extra one-off provenance fields were added because the current Convex validator accepts only `{ source: "oneOff" }`; recipe version identity is carried in the batch group name instead.

## Focused validation

- `pnpm --dir packages/core test -- src/nutrition/cooking.test.ts` — 1 file, 6 tests passed.
- `pnpm --dir apps/mobile typecheck` — passed.
- `pnpm --dir apps/mobile test -- --runInBand src/data/nutrition-cooking-repository.test.ts src/data/nutrition-cooking-helpers.test.ts src/screens/nutrition-cooking.test.tsx src/screens/nutrition-combos.test.tsx` — 4 suites, 18 tests passed.
- Pinned Biome `check` on the 12 owned cooking/Combo files — passed with no diagnostics after formatting/import organization.
