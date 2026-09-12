# Release 5 assistance slice checkpoint

This slice adds only new files. The parent-owned integration points are recorded
here so route and schema wiring can happen without changing the existing
nutrition screens or locale dictionaries.

## Route contracts

- `/(app)/nutrition-assistance` renders `src/screens/nutrition-assistance.tsx`.
  Optional params are `date` (`YYYY-MM-DD`, default today) and `meal`
  (`breakfast | lunch | dinner | snacks`, default breakfast). It owns the
  text-assisted batch preview and pasted-label review flow. It returns to the
  previous screen after the local operation is accepted; it does not wait for
  network acknowledgement.
- `/(app)/nutrition-weekly-review` renders
  `src/screens/nutrition-weekly-review.tsx`. Optional `startDate` is a valid
  `YYYY-MM-DD` week start; the screen defaults to the current week's Monday and
  passes adjacent week starts for previous/next controls.
- Both routes use per-route `ErrorBoundary` with the shared `RouteError` and
  the new assistance message module. Parent-owned navigation may add links
  later; these routes are independently addressable.

## Convex contracts

`convex/nutritionReviewModel.ts` exports `nutritionReviewTables`; the parent
has now spread it into `convex/schema.ts` and regenerated the Convex generated
types:

```ts
...nutritionReviewTables,
```

The exported table is `nutritionReviewDayMarkers` with a user/date index.

- `api.nutritionReview.week({ startDate })` returns exactly seven ordered day
  records, each with `date`, `entries`, `totals`, and `markedComplete`, plus
  `coverage` (`loggedDayCount`, `markedCompleteCount`) and independent
  `averages` for known energy/protein days. Missing days are returned with no
  entries and are not treated as zero intake.
- `api.nutritionReview.toggleComplete({ date, completed })` requires the
  authenticated owner, validates a real calendar date, and upserts/deletes the
  caller's marker only. It returns `{ date, completed }`.

The week query is bounded to seven indexed date reads and a finite per-day
entry cap; it does not scan the diary table.

## Parent integration checklist

- Schema spread and generated API types are integrated.
- Add navigation entry points as desired. No global locale keys are required:
  the screens import the bilingual `nutrition-assistance` message module.
- Keep the existing operation-service identity/acceptance behavior. Assistance
  uses `mintNutritionUuid()`, `createBatch`, and `create`; completion closes on
  local acceptance, while failure preserves the review form.

## Verification checkpoint

- Focused mobile Jest: 17 tests passed across parser, label, weekly coverage,
  double-submit, local-failure retention, personal-food retry reuse, pending
  device notices, missing-day unknowns, qualified totals, and marker failure.
- Focused Convex Vitest: 3 tests passed for authentication, bounded seven-day
  indexed reads, owner privacy, averages, date validation, and marker toggle.
- `pnpm --filter @workouts/mobile typecheck`: passed.
- Targeted Biome check: passed for the owned mobile TypeScript/TSX files;
  Convex files are covered by typecheck and the real Convex Vitest suite.
- Weekly review shows an explicit pending-device notice when local operations
  are not acknowledged; its server-only query exits to an offline retry state
  instead of skeletoning forever when disconnected without cache.
- Text parsing bounds input to 12,000 characters and 100 rows before local
  acceptance. Empty batches cannot enter review, and accepted actions are
  visibly disabled.

Photo/OCR label capture and meal-photo estimation remain explicitly gated and
unimplemented. The shipped flow is pasted label text only, not photo capture.
