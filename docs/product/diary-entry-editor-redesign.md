## Problem Statement

The mobile Diary Entry editor needs a clearer, more direct way to adjust logged food intake. The selected Round 5 design makes quantity, Serving selection, nutrition feedback, and meal/date changes easier to understand, but currently exists only as an interactive HTML demonstration. Its example data and placeholder actions do not establish a working mobile flow.

This implementation is also the first test of a wider mobile redesign and the proposed feature-oriented folder structure. It must establish reusable ownership and component patterns without replacing the everyday editor prematurely or copying the existing experimental implementation.

Adding a personal Serving to a Shipped Food must not require copying the whole food, hiding the shipped original, or taking ownership of its nutrition figures.

## Solution

Build a fresh, working Labs version of the Diary Entry editor using real diary data and the existing nutrition operations. Follow the selected Round 5 design closely: a prominent quantity capsule, Serving menu, logged-amount comparison, product/nutrition card, meal/date/delete toolbar, and keyboard-attached new-Serving popup. Keep the current everyday editor available during evaluation.

Target iOS first, including English and Dutch, light and dark appearance, and real keyboard and native sheet behavior. Use portable shared components and platform adapters where appropriate without making Android acceptance part of this first delivery.

Allow people to add Servings to Personal Foods or Shipped Foods and create reusable Personal Measures. Store additions to Shipped Foods separately, synchronize them across the person's account, and retain historical Diary Entry snapshots. Record the reusable patterns, the files created or changed, their placement, and the reasons for those boundaries in an implementation report.

## User Stories

1. As a person testing the redesign, I want to open it through Labs, so that I can evaluate it while retaining access to the everyday editor.
2. As a person testing the redesign, I want to edit a real Diary Entry, so that the test reflects my actual nutrition workflow.
3. As a person reviewing a Diary Entry, I want its current quantity, Serving, Meal Slot, and date prefilled, so that I understand what I am changing.
4. As a person editing intake, I want a prominent quantity control with minus and plus actions, so that common adjustments are quick.
5. As a person editing intake, I want to type a decimal quantity directly, so that I can enter an exact amount.
6. As a person entering quantities in Dutch or English, I want appropriate decimal input and formatting, so that my input is interpreted correctly.
7. As a person editing intake, I want useful quantity presets and a Done action above the keyboard, so that repeated amounts are easy to enter.
8. As a person selecting an amount, I want to see the equivalent base amount, so that I understand the physical quantity being logged.
9. As a person changing units, I want the exact amount preserved, so that changing representation does not unexpectedly change my intake or calories.
10. As a person choosing a Serving, I want food-specific Servings, Personal Measures, and the base unit clearly grouped, so that I can choose the appropriate kind of amount.
11. As a person using a Personal Measure, I want only compatible units offered, so that I do not accidentally treat grams as millilitres.
12. As a person correcting intake, I want nutrition values to update as I change the amount, so that I can understand the result before saving.
13. As a person correcting intake, I want the original logged amount and calorie difference visible when applicable, so that I can compare the change.
14. As a person reviewing food, I want the product and nutrient comparison presented together, so that the figures have clear context.
15. As a person reviewing food, I want the product header to open read-only details, so that I can inspect the source without entering an editing task.
16. As a person inspecting product details, I want my unfinished Diary Entry draft preserved when I return, so that looking up information does not lose my work.
17. As a person correcting intake, I want to change the Meal Slot, so that the entry appears under the right part of the day.
18. As a person correcting intake, I want quick date choices and an arbitrary date selection, so that I can correct entries beyond yesterday or tomorrow.
19. As a person correcting intake, I want to save valid changes and return to the diary, so that the corrected intake is visible.
20. As a person deleting a mistaken entry, I want the existing destructive confirmation, so that accidental taps do not remove history.
21. As a person dismissing an unchanged editor, I want it to close immediately, so that I am not interrupted by an unnecessary confirmation.
22. As a person dismissing a dirty editor, I want a consistent discard confirmation for close, swipe dismissal, and Back where supported, so that I do not lose changes accidentally.
23. As a person who chooses to keep editing, I want the draft retained after declining dismissal, so that I can finish my correction.
24. As a person adding a Serving, I want a popup above the real keyboard with a name and amount, so that I can define it without losing the editor context.
25. As a person naming a Serving, I want the keyboard's Next action to move to its amount, so that creating it is a continuous interaction.
26. As a person defining an amount, I want to choose a food-specific Serving or a reusable Personal Measure, so that its scope matches my intent.
27. As a person adding a Serving to a Personal Food, I want it saved with that food, so that its definitions stay together.
28. As a person adding a Serving to a Shipped Food, I want it associated with that food without creating a Fork, so that I retain the shipped food and its maintained nutrition figures.
29. As a person using multiple devices, I want my added Servings for Shipped Foods synchronized to my account, so that they are available across devices.
30. As a person logging offline, I want cached additional Servings to remain selectable, so that ordinary logging remains usable without a connection.
31. As a person creating an account-synced Serving or Personal Measure offline, I want a clear explanation that creation needs a connection, so that I do not mistake an unsaved definition for a saved one.
32. As a person confirming a new Serving or Personal Measure, I want it immediately selected in the editor, so that I can use it without searching again.
33. As a person who saves a reusable Serving and then cancels the Diary Entry edit, I want the Serving retained, so that completing one task is not silently undone by canceling another.
34. As a person canceling the creation popup before confirmation, I want no reusable definition created, so that an abandoned form has no side effects.
35. As a person entering invalid data, I want clear validation and my input retained, so that I can correct it without starting over.
36. As a person encountering a save failure, I want actionable feedback and a recoverable draft, so that I can retry without losing my changes.
37. As a person reviewing historical intake, I want previous entries unchanged when a food or Serving changes or disappears, so that my history remains trustworthy.
38. As a person editing an entry whose source is unavailable, I want its saved snapshot to remain usable and source-dependent actions to explain their unavailability, so that missing library data does not destroy my history.
39. As a person later creating a Fork to correct nutrition, I want my additional Servings copied into the new Personal Food once, so that I retain useful definitions without linking their future edits.
40. As a person using large text or assistive technology, I want readable content, accessible controls, and adequate touch targets, so that the redesigned editor remains usable.
41. As a person using either supported language or appearance, I want the complete editor and its error states to remain coherent, so that the design works beyond one demonstration configuration.
42. As a maintainer extending the redesign, I want clear feature, shared nutrition, and generic UI boundaries, so that subsequent screens can reuse patterns without depending on editor internals.
43. As a reviewer of this first implementation, I want a file-placement report and device evidence, so that I can assess both the architecture and fidelity to the selected design.

## Implementation Decisions

- Scope is a fresh Labs implementation over real persisted data. Preserve the current everyday editor and avoid an unrelated app-wide migration. The existing nutrition experiment branch may be consulted for guidance or diagnosis; do not copy its implementation.
- Adopt the proposed mobile folder structure for this slice. Routes own parameter validation, navigation, and presentation. A flat Diary Entry subject folder owns the editor screen, a single draft-state owner, supporting components, and colocated tests. Use kebab-case subject/task/role naming and matching component exports.
- Keep domain-aware components in the nutrition feature. Promote a component to shared nutrition ownership when another subject actually shares its contract. Generic controls and platform adapters belong to app-wide UI and must not import features. Existing data services remain canonical; shared calculations and catalogs remain in the core package.
- Separate viewing from editing. The product header opens read-only details. Use one screen for equivalent page/sheet content; introduce separate wrappers only when composition differs. Navigable tasks use routed presentations; auxiliary controls can be local. Preserve the draft while visiting details.
- Follow the Round 5 visual direction closely, including the quantity capsule, grouped Serving choices, logged delta, combined product/nutrient card, bottom toolbar, and keyboard-attached creation popup. The HTML's status bars, simulated keyboards, milk fixture, and placeholder actions are demonstration scaffolding, not application requirements.
- Use native materials and controls through platform adapters for glass/chrome. Resolve any conflict with older form composition guidance as a scoped redesign seam; do not globally restyle unrelated screens. Keep one owner for scrolling, keyboard positioning, safe areas, and chrome.
- On iOS, use the prototype's shared input-accessory approach for the name and decimal-amount fields, with Next moving focus to amount. Verify attachment to the real keyboard, including keyboard transitions and dismissal. Keep the interface portable for a later Android adapter.
- Preserve exact underlying amounts when switching between existing unit/Serving representations. Presentation formatting must not introduce the prototype's rounding to tens of base units or quarter Servings. Explicit quantity adjustments and confirmed creation/selection of a new Serving are separate user actions; the newly created Serving is selected at quantity one as in the prototype.
- Respect each food's actual base unit and existing conversion metadata. Do not assume a liquid food is measured in millilitres or invent gram/millilitre equivalence. Preserve existing per-Serving foods, One-off Entries, and missing/trace nutrient semantics rather than forcing the milk fixture's shape onto every entry.
- Rescale historical nutrition from the Diary Entry snapshot through existing operations. Selecting an amount must not replace its saved nutrition basis with a subsequently changed source. Display historical and current-source figures with clear context where they differ.
- Support real save, confirmed deletion, Meal Slot changes, and arbitrary dates through existing operations. Retain local acceptance and synchronization semantics rather than making ordinary diary changes depend on network availability.
- Maintain one draft per editing session. Clean dismissal is immediate. Dirty dismissal asks to discard for close, swipe, and Back where supported; keeping changes returns to the same draft. Account for pending operations so duplicate saves or ambiguous dismissal cannot occur.
- Confirming the creation popup persists a Serving or Personal Measure independently of the outer Diary Entry save. Only select the new definition after successful creation. Canceling the popup before confirmation creates nothing; canceling the outer editor does not undo a completed creation.
- Personal Food Servings remain embedded and follow existing Personal Food persistence. Personal Measures retain their existing reusable, account-synced contract.
- Add separate account-owned supplementary Serving records for Shipped Foods, keyed by permanent Shipped Food ID. Records require stable identity, a name, a positive amount, and the applicable base unit. Compose these records with shipped Servings and compatible Personal Measures at selection boundaries; do not simulate indexes into the immutable shipped catalog.
- Expose authenticated backend operations for supplementary Serving persistence and querying, with ownership checks and validated food/unit/amount inputs. Cache results per account for offline selection. Creating, changing, or deleting supplementary Servings requires a connection; local-first write queues for these records are not part of this scope.
- Adding a supplementary Serving does not mutate the shipped record, create a Fork, trigger Shadowing, or detach future logging from shipped nutrition updates. Historical entries remain frozen independently of any later source change.
- A later genuine nutrition-correction Fork copies the person's supplementary Servings into the new Personal Food once. Subsequent edits to the original additions and the Fork's embedded Servings are independent. Preserve original additions for continued use with the Shipped Food.
- Preserve snapshot-based editing when a Food Reference or saved Serving is unavailable. Disable or explain actions requiring an unavailable source; retain valid history. Never use a missing nutrient figure as zero.
- Include pending, disabled, validation, storage/network failure, and unavailable-source states. Translate visible copy and accessible names using the existing localization interface.
- The glossary retains Serving, Personal Measure, Diary Entry, Fork, and Shadowing as distinct concepts. A UI label such as “portie” does not introduce a competing domain type.

## Testing Decisions

- The user confirmed three boundaries: complete Labs editor journeys through the existing app-rendering harness, account isolation and persistence through public backend operations, and iOS device verification for visual fidelity, keyboard behavior, and dismissal.
- Prefer the highest existing seam. Render and drive the Labs route as a person would, observing displayed values, navigation, saved results, and public operation contracts. Do not create a separate test seam for every component or assert hook layout, private state, array indexes, or component structure.
- Use existing Diary Entry editor and transfer journey tests as prior art for opening a real route, changing quantities/Servings, saving, moving dates, confirming deletion, and retaining historical snapshots. Reuse the app-rendering harness and current data-boundary substitutes rather than inventing a parallel harness.
- Cover exact conversion with a non-round example: 1.25 Servings of 150 ml remains 187.5 ml when represented in base units. Exercise returning to the original representation without accumulating drift, locale decimal input, explicit quantity adjustments, and compatible-unit filtering.
- Cover clean dismissal, every supported dirty-dismissal path, keeping a draft, restoring original values, visiting product details and returning, and popup cancellation. Verify independently saved definitions survive outer cancellation and failed creation does not pretend to succeed.
- Cover supplementary Serving creation and selection for Shipped Foods, embedded creation for Personal Foods, reusable Personal Measures, immediate selection, offline cached usage, online-only management feedback, and missing-source behavior. Observe stable history after definitions change or disappear.
- Follow existing Personal Measure public-operation tests for authentication, account isolation, ownership enforcement, input validation, persistence, and updates/deletions. Add equivalent public-boundary coverage for supplementary Servings, including compatible food/unit validation and account-separated cached data.
- Cover the agreed Fork behavior through the existing food-creation/correction operation boundary: supplementary Servings are copied once, later edits are independent, and simply adding a Serving does not trigger Fork or Shadowing. Use existing core Serving tests only for calculation or composition cases not adequately exercised by higher-level journeys.
- Keep existing diary-operation snapshot and local-persistence regression coverage applicable. Verify changed source nutrition cannot silently replace a historical entry's nutrition during editing.
- Verify on iOS in both languages and appearances, including Dynamic Type XL, accessibility labels/touch targets, populated layout, native sheet chrome, safe areas, real keyboard/accessory transitions, and interactive dismissal. Exercise invalid/pending/failure states and offline behavior, not just the happy path.
- Capture screenshots against the selected design and a short recording for changed navigation, sheets, keyboard movement, and gestures. Record device/build/backend context and untested paths. Simulator checks do not establish physical-device haptics or final tactile feel.
- Run the project's applicable mobile, shared-core, and backend checks when implemented. Do not claim runtime or implementation tests passed while publishing this documentation-only spec.

## Out of Scope

- Replacing the everyday editor or rolling the redesign out across the app in this first implementation.
- Copying the existing nutrition experiment implementation or migrating unrelated legacy folders.
- Android device acceptance or a web redesign in this first delivery; preserve portable interfaces for future work.
- A new generic design-system framework or speculative shared components with no demonstrated reuse.
- Offline creation, modification, or deletion queues for account-synced supplementary Servings or Personal Measures.
- Editing the shipped catalog, creating a Fork merely to add a Serving, or changing historical Diary Entry snapshots when reusable definitions change.
- A new general-purpose Serving-management screen, catalog service, or nutrition-calculation engine.
- Broad product-editing redesign; the product header in this slice is a read-only viewing task.
- Production rollout, store submission, and unrelated dependency upgrades.

## Further Notes

- Published as [GitHub issue #91](https://github.com/AppElent/workouts/issues/91), labelled `ready-for-agent`.
- Authoritative visual reference and example code: [Round 5 design](../../designs/entry-editor/round5.html). Earlier rounds contain alternatives; Round 5 is the selected direction.
- Structural contract: [Mobile folder structure](../guidelines/project/mobile-folder-structure.md). Adopt it for this implementation without treating the whole existing app as already migrated.
- Domain vocabulary: [Project glossary](../../CONTEXT.md).
- Accepted storage decision: [Personal Servings for Shipped Foods](../adr/0010-personal-servings-for-shipped-foods.md), including one-time copying when a later Fork is created. This extends the existing local-first nutrition and read-only shipped-catalog decisions.
- Implementation report must list every created/changed file, where it lives, why that owner is appropriate, which components/patterns can be reused, verification performed, and limitations. Specific implementation paths belong in that report rather than this spec's implementation decisions.
- The scope and test boundaries are agreed. This document records the agreed specification. Implementation status, file ownership, and verification limits are recorded in the [implementation report](../verification/diary-entry-editor/README.md). The glossary clarification and new ADR were recorded during the discussion and travel with the implementation.
