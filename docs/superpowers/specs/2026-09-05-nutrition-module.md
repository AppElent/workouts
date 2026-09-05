# Nutrition Module — Product and Interaction Specification

**Date:** 2026-09-05
**Status:** Ready for implementation planning
**Source:** [Wayfinder #51](https://github.com/AppElent/workouts/issues/51) and its closed child issues
**Validated interaction:** [Prototype #67](https://github.com/AppElent/workouts/issues/67)

## Problem Statement

People using Workouts for health and body composition need to record what they eat and understand the day's intake against personal nutrition goals. The current product tracks physical Activity and body metrics but has no food diary. The solution cannot simply copy Gather's household-oriented nutrition model: this is an individual training app, targets are central, nutrition is not an Activity, and the mobile diary must remain quick enough to use several times every day.

Users need trustworthy figures without being forced to weigh everything. They must be able to use a broad Dutch food table, familiar servings, their own foods, packaged-food imports, and reusable combinations while retaining truthful provenance and historical totals. Incomplete source data must never be silently presented as zero or as a falsely complete total.

## Solution

Add **Nutrition** as the fifth native mobile tab, alongside Activity-oriented areas rather than inside them. Its iOS-first, goals-first day view shows current target progress above four meal slots. Users add foods through local search, barcode scan, an explicit Open Food Facts search, manual entry, or a saved Combo. Every logged item stores a nutritional snapshot in Convex, so diary history remains intact even when a source food changes or disappears.

The standard library ships with the app as a generated, read-only NEVO-derived dataset in `@workouts/core`. A bilingual overlay promotes commonly used foods with conversational names, aliases, emoji, and authored servings. Personal Foods and Combos live in SQLite on the device. Editing a shipped food creates a Personal Food fork and shadows the shipped result; shipped records are never edited in place. Targets and diary history live in Convex and therefore follow the signed-in user.

All eight supported nutrients are stored and visible: energy, protein, carbohydrates, fat, saturated fat, fibre, sugars, and salt. Targeted nutrients are prominent; the rest remain available in a compact collapsed section. Nutrient absence, trace values, zero, and incomplete totals remain meaningfully distinct.

## User Stories

1. As a signed-in user, I want Nutrition to be a first-class tab, so that I can reach my diary several times a day.
2. As a user, I want the tab and all Nutrition interface text in English or Dutch, so that the module follows my selected app language.
3. As a user, I want food names and serving labels in English and Dutch, so that changing app language does not make the library inconsistent.
4. As a user, I want today's goals shown before meal details, so that I immediately understand my progress.
5. As a user, I want to move to another calendar date, so that I can review or correct a different day's diary.
6. As a user, I want the diary day to change at my local midnight, so that entries align with my lived day.
7. As a user, I want to change an entry's date, so that a late or mistaken log can be corrected.
8. As a user, I want Breakfast, Lunch, Dinner, and Snacks to remain explicit slots, so that my day is easy to scan.
9. As a user, I want an accessible plus button on each meal slot, so that adding food is fast without repeating the word “Add.”
10. As a user, I want empty meal slots to explain how to add food, so that an empty diary is not confusing.
11. As a user, I want all eight nutrients available on the day view, so that relevant figures are not hidden from me.
12. As a user, I want nutrients with active goals emphasized, so that the most actionable numbers come first.
13. As a user, I want non-targeted nutrients available in a collapsed compact section, so that detail does not overwhelm the day view.
14. As a user, I want minimum goals to distinguish under from met, so that “more is beneficial” nutrients read correctly.
15. As a user, I want maximum goals to distinguish within from exceeded, so that “do not exceed” nutrients read correctly.
16. As a user, I want zero intake to remain visually neutral, so that the app does not celebrate or punish a day that has not been logged.
17. As a user, I want incomplete totals marked, so that I do not mistake partial source data for complete nutrition.
18. As a user, I want an absent nutrient to differ from a true zero, so that unknown data is not misrepresented.
19. As a user, I want trace nutrients shown as trace on a food, so that source precision is preserved.
20. As a user, I want trace amounts to contribute zero numerically while qualifying the total, so that arithmetic remains usable and honest.
21. As a user, I want a subtle training marker on days when I trained, so that the two records acknowledge each other without changing nutrition goals.
22. As a user, I want nutrition goals to stay static regardless of training load, so that the app does not invent expenditure or adaptive recommendations.
23. As a user, I want to create and edit one active set of nutrient goals, so that the diary reflects my current intent.
24. As a user, I want to set a minimum or maximum bound for any supported nutrient, so that the goal direction matches what I care about.
25. As a user, I want a range-capable data model even though the first editor sets one bound at a time, so that a later range does not require replacing my goals.
26. As a new user, I want optional goal presets rather than mandatory onboarding, so that I can start simply or configure goals later.
27. As a user, I want Reference intake, Lose weight, and Build muscle presets, so that I can start from a disclosed static baseline.
28. As a user, I want preset provenance shown, so that I know where a number came from and that it is not personalized medical advice.
29. As a user, I want editing a preset-derived goal to make it mine, so that later preset changes cannot silently alter it.
30. As a user, I want past diary days compared with my current goals in v1, so that the behavior is simple and predictable.
31. As a user, I want ordinary food search to stay local, so that it remains fast and works without a network request.
32. As a user, I want common promoted foods returned before the full raw catalogue, so that practical results are not buried among 2,328 technical rows.
33. As a user, I want an explicit “search all” path, so that I can reach any shipped NEVO food when needed.
34. As a user, I want search aliases shared across languages, so that familiar terms can find the same food.
35. As a user, I want shipped foods to use stable identity across releases, so that references and diary provenance remain meaningful.
36. As a user, I want retired shipped foods retained for identity and history, so that an app update does not repurpose or erase them.
37. As a user, I want familiar serving choices such as “Glass (200 ml),” so that I do not need a scale for ordinary logging.
38. As a user, I want every food to offer its base unit in the serving picker, so that I can enter an exact gram or millilitre amount when appropriate.
39. As a user, I want the selected serving displayed as its name multiplied by quantity, so that “Glass (200 ml) × 1” is unambiguous.
40. As a user, I want a beverage serving's volume mapped to a defensible gram amount when NEVO is mass-based, so that the calculation matches its source figures.
41. As a user, I want water-like beverages to allow the documented 1 ml ≈ 1 g fallback, so that common portions remain practical.
42. As a user, I want a promoted beverage to have a useful authored serving, so that a raw mass-only drink does not become a poor default result.
43. As a user, I want to edit an incorrect shipped food by creating my own fork, so that bundled source data remains immutable.
44. As a user, I want my fork to shadow its shipped original in normal results, so that I do not accidentally choose the version I corrected.
45. As a user, I want my fork to remain unchanged when a later app version corrects its source food, so that my data is never silently overwritten.
46. As a user, I want to create a Personal Food manually, so that foods missing from the shipped library can be reused.
47. As a user, I want Personal Foods stored on my device, so that ordinary use does not require a new synced food catalogue.
48. As a user, I want the app to disclose that Personal Foods and Combos may be lost on uninstall and do not appear on a second device, so that device-only storage is not surprising.
49. As a user, I want platform backup and restore to include local nutrition shortcuts when available, so that device migration has a best-effort recovery path.
50. As a user, I want a barcode control beside food search, so that scanning and typing are peer entry paths.
51. As a user, I want camera permission requested only after I choose Scan, so that the request has immediate context.
52. As a user, I want the camera purpose explained as scanning food barcodes to find nutrition information, so that consent is informed.
53. As a user who refuses camera permission, I want Search and Enter manually to remain available, so that permission is never a dead end.
54. As a user, I want barcode lookup to check local foods before the internet, so that known foods remain fast and available.
55. As a user, I want an explicit Open Food Facts online search action, so that ordinary local search does not unexpectedly send queries to a provider.
56. As a user, I want every Open Food Facts result reviewed as a Food Import proposal, so that inconsistent provider data is not silently logged.
57. As a user, I want an accepted import to become a reusable Personal Food before optional logging, so that future use is local and editable.
58. As a user, I want provider and barcode provenance retained through edits and diary snapshots, so that the source remains attributable.
59. As a user, I want lookup failure, poor coverage, or invalid imported data to leave Search and Enter manually available, so that online failure never blocks logging.
60. As a user, I want repeated online lookups cached briefly, so that the provider is not queried unnecessarily.
61. As a user, I want the request cache to expire rather than become a local provider mirror, so that licensing and storage boundaries stay clear.
62. As a user, I want to save selected diary entries as a named Combo, so that I can log foods I commonly eat together in one step.
63. As a user, I want a Combo to contain shipped foods, Personal Foods, and one-off entries, so that common combinations are flexible.
64. As a user, I want Combo quantities fixed at creation, so that logging remains one tap.
65. As a user, I want logging a Combo to create individual diary entries shown as one collapsed group, so that the diary is compact without losing item-level control.
66. As a user, I want to expand a logged Combo and adjust each part, so that today's portion can differ from the shortcut.
67. As a user, I want a Combo to be independent of a meal slot, so that I can choose its destination when logging.
68. As a user, I want deleted Combo references marked rather than silently replaced, so that a shortcut never changes meaning without my action.
69. As a user, I want a Combo never to contain another Combo, so that quantities and editing remain understandable.
70. As a user, I want diary history to survive deletion or loss of a Personal Food, so that past totals remain intact.
71. As a user, I want quantity edits to scale a diary entry's stored snapshot when safe, so that corrections are quick and deterministic.
72. As a user, I want nutrition figures and provenance snapshotted at logging time, so that later catalogue changes do not rewrite history.
73. As a user, I want NEVO attribution visible wherever its data contributes to calculation output, so that source terms are honored in context.
74. As a user, I want derived salt clearly disclosed as an Appelent addition, so that I can distinguish source data from calculation.
75. As a keyboard, switch-control, or screen-reader user, I want icon-only controls to have meaningful accessible labels, so that all primary actions are operable.
76. As a user, I want swipe actions and long-press menus to accelerate common actions but never hide the only route, so that discovery and accessibility do not depend on gestures.
77. As an iOS user, I want native edge-swipe navigation, sheet presentation, and restrained haptics, so that Nutrition feels native.
78. As a user with Reduce Motion enabled, I want the interface to respect that preference, so that feedback remains comfortable.
79. As an Android user, I want equivalent outcomes expressed with platform-native patterns, so that iOS-first does not mean iOS-only behavior.
80. As an offline user, I want shipped foods, Personal Foods, Combos, and existing diary data to remain useful, so that connectivity is not required for ordinary logging.

## Implementation Decisions

### Product boundary and vocabulary

- The module and fifth tab are named **Nutrition**. “Fuel” and “fuelling” are retired.
- Nutrition records food intake and is parallel to Activity and body metrics; it is not an Activity subtype.
- A **Goal** has its own lifecycle and is not embedded in Nutrition records. The storage entity is a nutrition target row, but user-facing language uses Goal consistently.
- “Meal” refers only to the four diary slots. **Combo** is the reusable set of foods logged together. “Set,” “Routine,” and “Preset” are not synonyms for Combo.
- Mobile interface chrome, food names, aliases, and serving labels ship in English and Dutch in v1.

### Ownership and storage

- Convex owns diary entries and nutrition targets. These records follow the authenticated user.
- SQLite owns Personal Foods, Combos, and the bounded Open Food Facts request cache. UUIDs are minted on-device. Migrations use SQLite's user-version mechanism.
- `@workouts/core` owns pure nutrition rules, target defaults/presets, the generated shipped-food artifact, its validation schema, and locale-independent search metadata.
- Diary entries are snapshot-first. Each stores the logged quantity, all eight nutritional figures with completeness state, source/provenance information, date, meal slot, and optional source identifiers. References aid traceability; they are not required to render or total history.
- Device-only shortcuts use stable IDs so eventual synchronization can reconcile them without changing v1 storage ownership.
- The architectural rationale is recorded in ADR 0005.

### Shipped food library

- Ship all 2,328 NEVO 2025/9.0 foods as a build-generated, bilingual, read-only JSON artifact. The measured source artifact is approximately 503 KB uncompressed and 95 KB gzipped.
- Generation consumes an unchanged NEVO extract, a hand-authored promotion overlay, and an append-only ID lockfile. The checked artifact validates against a Zod schema.
- Internal IDs are stable `shipped:` identifiers. NEVO edition plus code is source identity, not permanent application identity. A changed or returning NEVO code fails generation until explicitly matched to an existing ID or minted as new.
- Retired IDs are never deleted or reused.
- The overlay supplies conversational English/Dutch names, pooled aliases, one of ten category keys, emoji, promotion status, and up to three authored servings.
- Names describe food as eaten. Size words belong to servings, not names. Dry/cooked variants are explicitly separated where meaningful. Variety splits exist only where users make nutritionally relevant choices.
- Normal search returns promoted foods, Personal Foods, and other local matches; raw NEVO rows require “search all.” Search over 2,328 rows must be benchmarked on representative phones during implementation before choosing eager in-memory filtering or an indexed alternative.
- A shipped record is immutable at runtime. Editing forks it to a Personal Food with `forkedFrom`; that fork shadows the source in ordinary results. Later shipped corrections do not modify the fork.
- NEVO data cannot remain in a paid experience. Before charging for any product that includes this diary, the bundled dataset must be removed or separately relicensed.
- The architectural rationale is recorded in ADR 0006.

### Nutrients and calculations

- Store energy, protein, carbohydrates, fat, saturated fat, fibre, sugars, and salt using unrounded per-100 source/calculated values. Round only for presentation.
- Preserve `value`, `absent`, and `trace` states. Absence is not zero. Trace contributes numeric zero to aggregation while making the total qualified/incomplete.
- NEVO provides sodium rather than salt. Generate salt with `salt g = sodium mg × 2.5 / 1000`, preserve source sodium for traceability, and mark salt as an Appelent-derived addition. Absent sodium yields absent salt; trace sodium yields trace salt.
- A total composed from incomplete entries is still shown but visibly qualified.

### Servings and beverages

- Each food has a `g` or `ml` base unit and per-100 figures. The exact base-unit option is always available in the serving picker.
- Authored servings map a bilingual familiar label to an exact base-unit amount. The UI expresses selection as **serving name × quantity**, for example `Glass (200 ml) × 1`.
- Custom reusable named servings are authored while creating or editing a Personal Food, not ad hoc in every log flow.
- NEVO beverages remain mass-based. A volume-labelled serving maps to a defensible gram amount; water-like drinks may use the documented `1 ml ≈ 1 g` fallback. Do not add density or arbitrary millilitre conversion in v1.
- A beverage cannot be promoted until it has a practical authored serving; it remains reachable through “search all.”

### Day view and navigation

- Nutrition is a persistent fifth native tab. The canonical prototype is goals-first Variant A from prototype issue #67.
- The day view orders: date navigation, prominent goal progress, four explicit meal slots, then the collapsed non-targeted nutrient detail and required attribution/disclosures.
- Each meal slot has an icon-only plus control with a localized accessible label.
- The selected date is editable for both the day and individual diary entries. Day boundaries use the device's local calendar date.
- A training event may appear as a decorative marker only. It cannot modify targets, compute expenditure, or imply energy balance.
- Async views use layout-matching skeletons; empty slots and empty goal state use purposeful empty-state guidance. Mutation failures remain editable and surface an error; pending actions prevent duplicate submission.

### Find and log food

- Opening a meal's plus control presents Find Food for that meal and date.
- Search and barcode scan are peer controls. Ordinary search performs no provider request.
- Search ranks Personal Foods and promoted shipped foods before the raw catalogue. Users explicitly expand to “search all” or choose the Open Food Facts online action.
- Choosing a food opens a serving sheet. Users choose an authored serving or exact base units, set quantity, review scaled nutrition, and log.
- A successful log writes one immutable nutritional snapshot to Convex and returns to the updated diary.
- Users may edit quantity, meal slot, or date. Safe quantity-only edits rescale the snapshot rather than re-reading the source food.
- Deletion is confirmed with a verb-specific destructive action. Swipe may reveal edit/delete, but destructive full-swipe is disabled because confirmation is required. Visible non-gesture actions remain available.

### Personal Foods and imports

- Manual entry and shipped-food editing share the Personal Food authoring flow. The latter starts from a populated fork and retains source identity.
- Barcode scan requests camera permission only after the user invokes Scan. Local barcode matches are checked before Open Food Facts.
- The camera purpose string communicates: “Allow camera access to scan food barcodes and find nutrition information,” localized for English and Dutch.
- Refusal, lookup failure, weak coverage, or invalid provider fields keeps Search and Enter manually available.
- Open Food Facts is called directly from the phone; Convex must not proxy it because pooled backend traffic risks provider-wide rate limiting.
- Every provider result opens a Food Import review. Nothing is logged directly from remote data. Acceptance creates a Personal Food first; logging it is optional.
- Provider, barcode, and attribution metadata survive user corrections and are copied into diary snapshots.
- Cache identical requests for up to seven days. Expiration and bounded cleanup prevent the cache becoming an offline Open Food Facts mirror.
- Display Open Food Facts attribution on imported-food detail and where imported data contributes to calculation output.

### Combos

- A Combo is created by selecting existing diary entries, not by saving an entire meal slot.
- It stores a name and references plus fixed quantities for shipped foods, Personal Foods, and one-off entries. It has no meal slot and cannot contain another Combo.
- Logging a Combo writes one diary entry per part with a shared snapshotted group stamp.
- The day view renders those entries as one collapsed row. Expansion exposes each underlying entry for normal adjustment or deletion.
- Combo references do not silently follow a Personal Food fork. Missing/deleted references are marked and require user resolution.
- The logged diary snapshots remain valid even if the device-only Combo or one of its source foods later disappears.

### Goals

- Store one row per `(user, nutrient, direction)`. Direction is `min` or `max`; the model is range-capable by allowing both rows, while the v1 editor manages one bound for a nutrient.
- All eight nutrients are targetable. Core defines the default direction for each; energy defaults to `max`.
- Ship three static presets: Reference intake, Lose weight, and Build muscle. They never derive values from body metrics, Activity, or estimated expenditure.
- Reference intake cites EU Regulation 1169/2011 Annex XIII and EFSA fibre guidance. The other two disclose their fixed deltas from that reference rather than implying individualized advice.
- Applying a preset forks its values into the user's target rows and retains `sourcePreset` only as a label. Editing any value clears that row's preset association; counts such as “2 edited” are derived.
- Goal configuration is a pushed screen, never an onboarding gate. No-goal state offers preset cards and manual setup.
- Past days compare against current goals in v1; goals are not versioned.

### Native interaction and accessibility

- Use iOS-native tab, navigation, sheet, edge-back, context-menu, and haptic semantics where supported. Android delivers equivalent outcomes using its native conventions.
- Swipes and long press are accelerators only. Every action has a visible or conventionally discoverable non-gesture route.
- Haptics are restrained: selection feedback for meaningful picker changes, success for completed logging, and warning for destructive confirmation—not on every tap.
- Respect Reduce Motion and platform accessibility settings. Icon-only buttons have localized accessible names, hit targets meet platform guidance, dynamic type does not clip nutrition values, and color is never the sole state signal.

### Provenance and attribution

- Preserve separate concepts for record origin, nutrition source, and whether local edits occurred.
- Show NEVO attribution wherever NEVO-derived calculation output appears, including the day view. Include the salt derivation disclosure there.
- Show Open Food Facts attribution for imported-food output. Editing imported values does not remove provider provenance.

## Testing Decisions

- Good tests assert observable behavior and durable contracts, not component structure, hook calls, SQL statements, or Convex implementation details.
- The highest acceptance seam is the user-visible mobile Nutrition flow. Test the goals-first day, date and meal navigation, local find-and-log, serving selection, editing/deleting, target setup, Personal Food/import review, Combo creation/logging, incomplete data, localization, accessibility labels, and offline/provider-failure exits.
- Test Convex through its public nutrition operations: authenticated ownership, target uniqueness/direction, snapshot creation, quantity/date/meal edits, Combo group stamps, deletion, and totals that remain stable after source loss. These are contract/integration tests, not table-layout tests.
- Test SQLite through one repository boundary: migrations, stable IDs, create/update/delete Personal Foods and Combos, fork shadowing, dangling references, request-cache expiry, and persistence across repository recreation. Avoid asserting raw SQL except migration compatibility.
- Test `@workouts/core` as pure public behavior: shipped artifact schema and ID-lock invariants, locale/alias search and ranking, serving scaling, beverage mappings, salt derivation, absence/trace aggregation, target state machines, and preset constants/provenance.
- Benchmark shipped-list initialization and representative searches on low/mid-tier supported phones. Treat acceptable interaction latency and memory as an implementation gate; do not lock the spec to an unmeasured search strategy.
- Exercise camera permission denied/restricted, unknown barcode, provider timeout/rate limit, incomplete product, and invalid nutrient inputs while confirming Search and manual entry remain available.
- Verify English/Dutch parity, screen-reader order and labels, dynamic type, non-color state communication, Reduce Motion, keyboard/switch access where supported, and that gesture actions have visible equivalents.
- Existing prior art includes pure Vitest tests in `@workouts/core`, public-module tests in the web client, and shared UI behavior tests. The mobile app currently lacks a mature automated screen-test harness; implementation planning must choose the smallest compatible React Native behavior-test setup plus targeted device verification rather than testing internal components.
- Static gates remain formatting/lint, typecheck, unit/integration tests, and production build. Native verification runs in a dev client on iOS first, followed by Android parity checks.

## Out of Scope

- Nutrition history, trends, and progress charts. Diary data accumulates now; target versioning/effective dates arrive with that later work.
- Recipe authoring, recipe-linked entries, or a searchable “meal I cooked” composite food. Combos cover reusable multi-part logging in v1.
- AI nutrition estimation.
- Hydration or dedicated water logging.
- Synchronization of Personal Foods and Combos between devices.
- Web Nutrition UI.
- Adaptive goals, expenditure calculation, training-load-based targets, or medical/personalized dietary recommendations.
- Nested Combos or arbitrary Combo scaling at log time.
- Arbitrary density conversion or arbitrary millilitre input for mass-based NEVO beverages.
- Removing Gather's deprecated nutrition module.
- Building the EAS/OTA delivery pipeline as part of Nutrition.

## Further Notes

- The prototype is evidence for hierarchy and interaction decisions, not implementation markup. Recreate the behavior using native Expo/React Native primitives.
- The runtime strategy for parsing, holding, and searching all 2,328 shipped rows remains explicitly unresolved until measured. The public search behavior above is fixed; its internal index is not.
- Device-only loss is an accepted v1 trade-off, not an accidental limitation. Product copy must disclose uninstall and second-device behavior before users invest heavily in Personal Foods or Combos.
- Open Food Facts is the cuttable edge of v1 if release scope must contract. Its interfaces must not make the local diary depend on provider availability.
- NEVO licensing is a continuing product constraint. A future paid tier that includes Nutrition triggers a data-source decision before launch.
