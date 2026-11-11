# `@foundry/core`

The rules shared by the web app, Convex and `apps/mobile`. Dependency-free: no DOM, Node, React,
Convex or Sentry imports, so the same code runs in Vite, Convex's esbuild and Metro/Hermes.

## Entries

| Entry | Holds |
| --- | --- |
| `@foundry/core` | Everything that does not read the shipped food artifact. |
| `@foundry/core/shipped-foods` | Only the code that reads the ~500 KB shipped food artifact: the library, search, forks of shipped foods and snapshots built from them. |
| `@foundry/core/exercises` | The exercise catalog. |

The entries export disjoint names. esbuild inlines an imported JSON module into every bundle that
reaches it, so the web app and Convex functions that never read shipped foods import only the
barrel. Each entry resolves to `dist/` for Vite and Convex and to `src/` (the `react-native`
condition) for Metro. Test hooks (`resetSearchIndex`, `SHIPPED_ARTIFACT`, `loadShippedLibrary`) are
imported by relative path from tests and `scripts/`, never from an entry.

## Conventions

- **Rules return codes, never display text.** A broken rule is a `field` and a `code`
  (`RuleIssue`). Convex turns it into `ConvexError({ code, field })` (`convex/lib/errors.ts`) and
  each client localizes it.
- **`validate*` returns a `RuleResult`**: `{ ok: true, value }` or `{ ok: false, errors }` with
  every issue it found.
- **Compute and `normalize*` functions throw a `RuleError`** (its `message` is the code) on input
  they expect to be valid. `ruleResult(() => …)` turns that throw into a result and `ruleValue`
  turns a result back into the throw.
- **Field paths are dotted**: `name.en`, `servings.0.amount`, `parts.1.snapshot.nutrients.energy`.
- **Vocabularies are `as const` tuples with a derived type**: `MEAL_SLOTS` / `MealSlot`.
- **Hermes**: no `normalize("NFD")`, no `Object.hasOwn`; `Intl` APIs are guarded.
- Tests live next to the module as `*.test.ts` and run under Vitest.

## Cross-client plumbing

| Module | Owns |
| --- | --- |
| `rules.ts` | `RuleResult`, `RuleError` and the helpers above. |
| `i18n.ts` | `SUPPORTED_LOCALES`/`Locale`, locale resolution, `fmt`, `plural`, and `messageParityMismatches` for each app's message test. |
| `observability.ts` | Sentry privacy passes over structural event types. |
| `account-export.ts` | `collectExportTables` pages through the personal-data export; `accountExportJson` writes the file both apps share. |
| `convex-error.ts` | `APP_ERROR_CODES` the server throws; `parseConvexError`: `{ code?, message }` from any failed Convex call; `convexErrorMessage`: a client's message for the code, else the server's text, else a fallback. |
| `auth.ts` | The dev test-login gate and the Clerk error code → message key map. |
| `json.ts` | `canonicalJson` (operation fingerprints). |

## Nutrition modules

| Module | Owns |
| --- | --- |
| `nutrition/snapshot.ts` | The contract: vocabularies, Food Visual, Food Provenance and the Diary Entry snapshot. Types and tuples only. |
| `nutrition/nutrients.ts` | The eight nutrients, units, display rounding, kJ → kcal, nutrient value validation. |
| `nutrition/aggregate.ts` | Totals (`totalNutrients` takes entries; an estimated reading qualifies a total) and combined readings. |
| `nutrition/servings.ts` | Serving options and the only code that builds or re-reads a Serving label. |
| `nutrition/personal-food.ts` | Personal Food normalization, validation and snapshots; `PERSONAL_FOOD_TEXT_LIMIT`. |
| `nutrition/combo.ts` | Combo types, normalization/validation and totals. |
| `nutrition/goals.ts` | Goal presets, validation, goal history, bounds and `evaluateGoal`. |
| `nutrition/week.ts` | The weekly average (today counts once logged). |
| `nutrition/meal-time.ts` | `mealSlotAt`, the default Meal Slot for a moment. |
| `nutrition/named-amount.ts` | Personal Measure and supplementary serving names and amounts. |
| `nutrition/ai.ts` | The nutrition assistant's limits and plausibility figures. |
| `nutrition/library-protocol.ts` | Personal library record kinds, categories and batch size. |
| `nutrition/diary-correction.ts` `nutrition/snapshot-rescale.ts` | Correcting and rescaling a Diary Entry snapshot. |

The shipped food library itself is documented in `src/nutrition/README.md`.

## Training modules

| Module | Owns |
| --- | --- |
| `units.ts` | `LOAD_UNITS`, `KG_PER_LB`, `convertLoad`/`toKg`, `DISTANCE_UNITS` |
| `exercise.ts` | `EQUIPMENT` and its traits (loaded, default weight step), exercise categories, the muscle-group taxonomy, `filterExercises` |
| `strength.ts` | `SET_TYPES`, `SET_LIMITS` and set/plan validators, One-rep Max reference eligibility and precedence, records, work volume, rep-max curve |
| `oneRepMax.ts` | Epley and its inverse, load rounding |
| `plates.ts` | plate breakdown and warm-up ramp |
| `wodScore.ts` | WOD and hosted vocabulary, which timing field each WOD type stores, score limits and validation, building, ranking, leaderboard order, formatting |
| `activity.ts` | Activity/endurance sports, endurance validation, pace/speed/totals |
| `calendar.ts` | `IsoDate` day arithmetic and ISO weeks, with no implicit timezone |
| `format.ts` | locale-neutral clock, session duration and pace strings |

Product rules these modules encode (change them here, not in an app):

- Set weights are limited in the set's own unit (0–2000), so 2000 lbs is valid.
- A set feeds One-rep Max references only when it was explicitly logged with a positive load and at least one rep, on an exercise that is not bodyweight (`isReferenceEligible`). Records apply the same rule and compare in kg.
- A session's One-rep Max is Measured unless a newer Manual entry exists; the current 1RM falls back to Estimated after that.
- Work volume excludes warm-ups and is in kg.
- Hosted leaderboard ties go to the earliest submission.
- Calendar helpers never read the device or server timezone: pass local date parts (`isoDateFrom`) or an instant with its UTC offset (`isoDateAt`).
- Anything with words or decimal separators is rendered by the apps; `format.ts` returns strings that read the same in every locale.

## Adding a value to a vocabulary

Add it to the tuple and run `pnpm typecheck`: `Record<Tuple, …>` tables, exhaustive switches
(`noImplicitReturns`) and Convex `literals()` validators fail until every place handles it. What the
compiler cannot see is the stored data and prose:

- **Nutrient**: Convex `perNutrient` makes every key required on stored rows, so a new key ships
  optional there or after a backfill. The nutrition assistant's prompt text in
  `convex/lib/nutritionAi.ts` names the nutrients in prose; its JSON schemas follow `NUTRIENT_KEYS`.
`DefaultExercise` lives in `src/exercises/types.ts` so the generated `wrkoutExercises.ts` does not import the curated catalog. Regenerate it with `pnpm --filter @foundry/core import:exercises <wrkout checkout>` (see `src/exercises/README.md`).
