# A — Compact daily summary

## Read

`apps/mobile/src/screens/nutrition-day.tsx`, `src/data/nutrition-day.ts`, `src/ui/date-stepper.tsx`, `src/theme/tokens.ts` (the latter paths relative to apps/mobile), and `packages/core/src/nutrition/aggregate.ts`. Read the existing day, empty-goals, loading, offline, accessibility and goal-state tests.

## Implement

Keep NutritionDayScreen responsible for date, data subscriptions, navigation and selection state. Extract a local summary component and a pure presentation helper if useful. Reuse core totalNutrients for meal subtotals; never sum displayed strings or count a Combo header as an extra entry.

Layout order:

1. Existing date navigation and training marker, with minimal duplicate headings.
2. Compact energy summary and protein/carbs/fat rows.
3. Collapsed additional active goals, with count and an Edit goals action.
4. Existing Combo controls in a compact row, then Breakfast/Lunch/Dinner/Snacks with subtotals and plus buttons.
5. Existing other-nutrient details and attribution.
6. Add food footer, outside the scrolling content, above the app's tab bar.

Keep existing Combo selection, expansion and editing behavior unchanged. It can move visually but stays discoverable. No blank region for an empty meal: compact instructional text in the meal section is sufficient.

### Energy display rules

Let E be unrounded recorded energy, L the energy minimum if present, U its maximum. Derive comparisons before rounding. Show the target/bounds beside the amount; do not hide them behind a progress bar.

| Case | Primary display | Supporting display |
| --- | --- | --- |
| No entries | 0 kcal logged | Configured target if any; neutral appearance, no success/failure status |
| Entries, no energy goal | E kcal logged | Set goals action |
| Maximum only, E < U | U−E kcal remaining | E logged / U target |
| Maximum only, E = U | Target reached | E logged / U target |
| Maximum only, E > U | E−U kcal above target | E logged / U target |
| Minimum only, E < L | L−E kcal to minimum | E logged / minimum L |
| Minimum only, E ≥ L | Minimum reached | E logged / minimum L |
| Both bounds, E < L | L−E kcal to range | E logged / L–U target |
| Both bounds, L ≤ E ≤ U | Within target range | E logged / L–U target |
| Both bounds, E > U | E−U kcal above range | E logged / L–U target |
| Invalid persisted range L > U | E kcal logged | Review goals action, no remaining/status assertion |

Completeness takes precedence over numerical goal status. If absentCount > 0, show “Known energy: E kcal · incomplete”; if every value is absent show “Energy unavailable.” Display configured targets as reference only. Suppress exact remaining and success status. If trace-only qualification exists, mark recorded energy approximate; display target as reference and omit exact remaining for this release. Reuse that rule in macro and extra-goal presentation.

### Macro rows and extra goals

Always show protein, carbs and fat amounts in grams; without targets they are plain intake values. With one bound use “minimum” or “maximum”; with two show both. Each row is compact and labels accompany color. Use horizontal progress bars if useful; do not create large rings. Neutral empty state, incomplete/approximate handling and range rules match energy.

Group extra goals by nutrient (saturated fat, fibre, sugars, salt), with both bounds together. The collapsed label counts nutrients, not database rows. Expanding shows every bound; Edit goals is always reachable. Existing untargeted-nutrient detail remains accessible. Avoid duplicated extra goal information.

### Footer navigation

Inspect `(app)/(coach)/_layout.tsx`, `nutrition.tsx` route and shared screen wrapper before deciding padding. Let the navigation container own its tab-bar inset; do not add guessed tab-bar heights. The footer must not cover the last attribution/meal row or any active-session bar.

Add food routes to `/nutrition-food` with current selected date and meal `breakfast` as the deterministic initial default. Task C makes that default visible and editable in the browser. Meal plus passes its actual meal. Disable global Add food during Combo selection to avoid disrupting selection; keep Cancel/Continue reachable.

Match the new ready layout with skeletons. When diary data is unavailable offline, retain honest unavailable content and add controls; never substitute a false zero summary.

## Acceptance tests

Add focused tests for the table above using pure fixtures, especially no entries versus entries with all energy absent, equality, trace, no goal, both bounds, invalid range and over-target. Verify meal subtotals include each Combo part exactly once. Screen tests verify all four slots, additional goals disclosure, Edit goals, global Add food date/meal params and existing meal-plus routes. Preserve offline/error and Combo behavior tests.

Device target: at standard text size on a representative iPhone, summary and Breakfast heading/add control are visible without scrolling. At large text, favor readable vertical expansion over enforcing that target. Completion: tests pass and layout overflow is checked or explicitly pending native verification.
