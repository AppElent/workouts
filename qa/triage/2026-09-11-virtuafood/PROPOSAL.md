# iOS QA Fix Proposal

## Summary

Prepared 2026-09-12 using the ios-video-qa **propose** workflow. Scope: the native Nutrition module, with a roadmap toward an excellent everyday food logger. This is an implementation proposal; no product code was changed.

**Product direction: make a normal meal take seconds to record, make unusual meals possible, and make every number understandable.** The strongest differentiator should be how little repetitive work the diary asks of someone after their first week.

Build in this order: simplify the existing diary and portion sheet; make repeat logging excellent; make search and packaged-food entry reliable; strengthen persistence and history; then add recipes, insights, and assisted capture.

### Evidence quality and corrections to the earlier reports

The existing extraction command sampled every five seconds and stopped at 24 frames: approximately the first two minutes. The full recording's coverage and duration were not established. Do not treat TRIAGE.md as a complete feature inventory or a completed end-to-end competitor test. Photo recognition, favorites behavior, and shopping-list behavior are advertised or exposed by controls; their working flows and accuracy were not demonstrated in the reviewed frames. A peeking carousel card is not by itself a clipping defect.

Several evidence references in the reports are inaccurate. The existing images reside in the parent folder, not beside these reports. The useful corrected references are:

| Topic | Evidence |
| --- | --- |
| Weight and target setup | [sample-02](../sample-02.png), [sample-04](../sample-04.png) |
| Plan choice and result | [sample-10](../sample-10.png), [sample-14](../sample-14.png) |
| Advertised premium capabilities | [sample-15](../sample-15.png) |
| Diary and primary add action | [sample-22](../sample-22.png) |
| Food-language warning | [sample-23](../sample-23.png) |
| Search rows and capture modes | [sample-24](../sample-24.png) |

These images were visible earlier in this conversation. Reopening them in this turn failed in the Windows image helper; this proposal uses that existing visual evidence and fresh source inspection. Our current app was assessed from source and tests, not a newly running device build. Interaction speed and visual superiority remain hypotheses to test on-device.

The source already implements barcode scanning, local-first barcode lookup, explicit online search, imported-food review, personal foods, authored portions, exact grams/ml, entry editing and moving, and saved Combos. They are not missing features. Our diary already puts goals first. Its opportunity is compactness and emphasis.

## Proposed fixes

### QA-001 — A compact, useful Today screen

- **Evidence:** sample-22; `apps/mobile/src/screens/nutrition-day.tsx` (`GoalSection`, `GoalRow`, `MealSection`, `ComboControls`), `src/data/nutrition-day.ts` under the mobile app.
- **Root-cause hypothesis:** every goal gets a full vertical row, including all eight preset targets; Combo administration sits above meals. This makes a simple status check and the first meal more distant than necessary.
- **Confidence:** high in structure; medium in on-device impact.
- **Proposed change:** one compact summary, followed immediately by the diary. If an energy maximum exists, show consumed/target and remaining; above target, say “120 kcal above target.” With a minimum only, say “to minimum”; with both bounds, show the range. With no energy goal, show consumed energy and an optional Set goals action. Keep the zero-entry day neutral.
- Show protein/carbs/fat in compact rows or tiles with grams as primary values. Preserve minimum/maximum meaning. Expose every other active goal in a compact Goals disclosure with a visible count; offer one optional pinned nutrient such as fibre. Show untargeted nutrients in Details.
- For incomplete energy totals, show “Known energy: … · incomplete” and suppress an exact remaining claim. Carry trace/qualified states into summary and meal subtotals.
- Give each meal a subtotal and its existing plus control. Make empty meals compact rows with useful instructions. Move Create Combo into meal/selection actions and Log Combo into Add Food.
- Add a persistent labeled Add food action that opens the same browser as meal plus buttons. Its date is always the selected diary date; default meal can be remembered but must remain visible and editable. Retain all four meal slots.
- **Why:** improves the established goals-first design without replacing its data model.
- **Alternative:** three large rings; reject as the default because they consume space and imply identical goal semantics.
- **Regression risks:** hiding active goals, incomplete totals looking exact, action bar obscuring the last row or keyboard.
- **Verification:** no goals; protein-only goal; eight goals; min/max range; exceeded maximum; absent/trace data; long Dutch names; large text; safe area with tab bar and any active-session UI.
- **Scope:** medium. **Ready to implement:** yes, with the behavior above.

### QA-002 — Goal setup that feels approachable

- **Evidence:** sample-02/04/10/14; `nutrition-goals.tsx`, `packages/core/src/nutrition/goals.ts`, `convex/nutritionGoals.ts`.
- **Root-cause hypothesis:** the editor renders eight nutrients times two directions: sixteen editable cards, including unused bounds. It exposes the storage model directly.
- **Confidence:** high.
- **Proposed change:** optional Start logging / Set goals entry; a short goal setup with existing disclosed presets or custom values, then a preview. Initially expose energy and the user's chosen nutrients. Add nutrient and Add upper/lower bound reveal advanced controls. Keep existing ranges editable and never drop hidden bounds during save.
- Use “grams” as the default macro editing unit. Percentage-based macro planning is a later calculator, not a reinterpretation of current min/max bounds. Support Dutch decimal commas consistently; the current goal editor uses `Number(target)` while the portion sheet normalizes commas.
- Preserve a dirty form when a live query changes. The current effect rebuilds drafts on each changed `current` value; add a focused test before changing this behavior.
- Keep setup skippable. Fixed reference presets must remain described as fixed reference presets. Personalized calorie estimation can become a separate opt-in step after selecting and validating its method; this proposal supplies no new nutrition formula.
- **Why:** eliminates complexity immediately without requiring body-profile collection.
- **Alternative:** mandatory profile wizard before logging; adds friction to the first useful action.
- **Regression risks:** discarding advanced goals, contradictory bounds, misleading personalization, resetting unsaved inputs.
- **Verification:** retain both bounds through simple edit; reject min > max; skip setup and log; decimal commas; failed save; live refresh during editing.
- **Scope:** medium for simpler editor; large for personalized estimation. **Ready to implement:** yes for editor; estimation needs a separate method specification.

### QA-003 — One place to add food, with repeat logging first

- **Evidence:** sample-24; `nutrition-food-browser.tsx`, `nutrition-combos.tsx`, `personal-foods.tsx`, `personal-food-repository.ts`.
- **Root-cause hypothesis:** browser controls are a vertical collection of search scopes and creation actions; successful logging calls `onClose`, making the next ingredient restart navigation. There is no favorites/recents API in the inspected local repository.
- **Confidence:** high.
- **Proposed change:** Add Food opens directly into a browser with date/meal context, search and barcode as peers, and three destinations: Recent, Favorites, Combos. “My foods” is a filter; manual creation is available from search/no-result state. Do not put a mode-selection screen before every search.
- Make the empty search useful: a short Recent list ranked by selected meal, then recency, with stable tie-breaking. Remember the last confirmed portion per stable food identity. Never guess a serving from a similar name.
- Offer Add & continue on the serving sheet and Done in the browser. Keep search text and scroll position between additions. Show confirmation inline and retain failed additions for retry.
- After persistence work described below, allow a visible plus next to a recent food's explicit saved portion. Row tap opens adjustment. Examples: “Skyr · 250 g · 160 kcal” with an add control; numbers are illustrative.
- Add “Copy from…” on a meal, defaulting to yesterday's same meal, with a preview and editable destination. Copy snapshots into new entries with fresh group IDs; do not re-read a possibly changed source catalog. Existing Combos continue to resolve current source records according to their current contract.
- **Why:** recurring breakfasts and lunches should become almost effortless.
- **Alternative:** seven equal capture buttons including AI; this overweights occasional actions and advertises an unbuilt path.
- **Regression risks:** duplicates, wrong selected day, obsolete portion memories, personal-account leakage from new local history, partial multi-item writes.
- **Verification:** add three foods with one browser visit; repeated taps create one submission; copy a meal after its source is deleted; preserve selected past date; failures keep portions and selections; different users never see each other's new recents.
- **Scope:** large across small releases. **Ready to implement:** yes for navigation and Add & continue; quick-add and copy depend on the persistence contract below.

### QA-004 — Search and portions that earn trust

- **Evidence:** sample-24; `nutrition-food-browser.tsx` (`resultCaption`, `ServingDetail`, `servingChoices`), core `search.ts`, `overlay.ts`, `servings.ts`; food-browser/import/fork tests.
- **Root-cause hypothesis:** local result rows omit kcal, many captions show only per-100 basis or provenance, and the serving sheet puts the submit action after eight nutrient rows and disclosures inside its scroll content.
- **Confidence:** high.
- **Proposed change:** consistent rows with name, optional brand when available, energy and an explicit basis (100 g, named serving, or remembered portion). Distinguish dry/cooked variants in visible names. Keep original source names available in detail. Maintain a stable thumbnail slot using existing emoji initially; real photos are a later optional enhancement with a fallback.
- Keep ordinary search local and the online action explicit. Present online matches in an accessible section near the active search, not below a long local list. Preserve fork precedence. Guard asynchronous results so an old query or canceled scan cannot replace the current search state.
- Portion sheet: title, selected amount and unit, quick multipliers ½ / 1 / 2 where meaningful, energy + macros, expandable nutrient detail, and a keyboard-aware sticky Add button. Always offer exact base units. Defaults: last confirmed portion, else authored default, else a clearly displayed 100 g/ml. Reuse existing scaling functions and retain attribution in context.
- Scanning a known barcode should reuse the local food. Unknown barcode keeps the code when entering manually. Import review should emphasize name, per-100 units and core nutrition; retain access to all fields. Lookup waiting should use a meaningful skeleton with a way back.
- **Why:** less opening of wrong foods, less scrolling before confirmation, and fewer repeated unit decisions.
- **Alternative:** build a new food database; existing NEVO/Open Food Facts boundaries already cover the main paths.
- **Regression risks:** confusing per-serving and per-100 values; replacing absent values with zero; invalid photo metadata; losing provider/fork provenance.
- **Verification:** dry versus cooked search; bilingual aliases; corrected source ranking; exact grams and milk servings; invalid imports; out-of-order searches; denied camera; long labels; keyboard visible while submitting.
- **Scope:** medium; photography optional. **Ready to implement:** yes.

### QA-005 — A distinctive, calm visual treatment

- **Evidence:** sample-22/24; `apps/mobile/src/theme/tokens.ts`, `ui/coach.tsx`, `ui/text.tsx`, `ui/date-stepper.tsx` and nutrition screen styles.
- **Root-cause hypothesis:** repeated equally weighted cards and headings dilute the primary values and actions.
- **Confidence:** medium; requires device comparison.
- **Proposed change:** retain the native app's warm dark palette and lime action color. Use one large energy figure, smaller macro figures, quiet separators within meal groups, and minimal nested cards. Introduce nutrition-specific semantic colors through the theme rather than inline literals; pair color with labels and goal-state text.
- Use a single date header with previous/next controls and a tappable date opening a calendar. Keep Today return. Avoid redundant title/date blocks.
- Use restrained animation for confirmed additions, respect Reduce Motion, and let larger text turn macro tiles into stacked rows. Preserve accessible names for every icon action.
- **Why:** recognition and focus matter more than decoration. Food imagery can help search recognition but should not dominate the diary.
- **Alternative:** copy VirtuaFood's bright backgrounds, oversized rings and carousel; this conflicts with the current app's coherent native identity.
- **Regression risks:** contrast, Dynamic Type clipping, accidental global theme changes.
- **Verification:** small iPhone, large text, VoiceOver traversal, reduced motion, equivalent Android keyboard/back behavior.
- **Scope:** medium, integrated with QA-001/004. **Ready to implement:** yes.

### QA-006 — Make reliability part of the experience

- **Evidence:** current import attribution and failure handling; spec stories 48/55/70/80; local-storage ADR 0005; direct mutation calls in `ServingDetail`; offline tests exercise availability of controls but do not establish survival of app termination.
- **Root-cause hypothesis:** convenient local authoring and synchronized diary history are separate systems. A pending network mutation is not sufficient evidence of durable offline logging.
- **Confidence:** high in observed boundaries; offline kill/relaunch behavior still needs reproduction.
- **Proposed change:** first verify airplane-mode logging, force-close, relaunch, reconnect. Define an explicit durable save contract for repeat/batch logging: persist a user-scoped operation and snapshot locally before showing it as queued; render pending entries; reconcile with server IDs; deduplicate retries through an operation ID on the backend. Distinguish Saved on device, Syncing, and Synced in a quiet status surface. Keep failed operations actionable. Do not implement a second overlapping queue without checking existing infrastructure.
- Design edits/deletes to a queued entry as local operations against that same stable pending identity. Prevent an offline user switch from replaying one account's entries as another. Use a single atomic server mutation for confirmed meal-copy batches.
- Preserve the existing explicit online action, truthful source labels, and ad-free logging. A source badge must not imply independently verified nutrition.
- **Why:** a logger must remember a meal at least as reliably as a note.
- **Alternative:** optimistic UI alone; it improves perceived speed but does not prove persistence.
- **Regression risks:** duplicate writes after lost acknowledgements, local/server divergence, stale totals, account mixing.
- **Verification:** force-close before acknowledgement; reconnect twice; failure and retry; pending edit/delete; user switch; exact once-only totals.
- **Scope:** large if durability is absent. **Ready to implement:** verification first, then specify queue behavior from the result.

## Cross-cutting findings

### Deliberate v1 decisions to evolve explicitly

The September 5 spec deliberately uses current goals for every historical day, static targets regardless of exercise, local Personal Foods/Combos, fixed Combo quantities, and manual entry through Personal Foods. These are not defects. This roadmap proposes specific future changes:

| Boundary | Recommendation |
| --- | --- |
| Historical targets | Before trends, introduce goal versions effective from a local calendar date. Default changes to today onward. Label pre-migration comparisons as using a reference goal; do not invent unknown past targets. |
| Personal library | Add account backup/sync before broader use. Evolve ADR 0005: local access remains fast; stable IDs survive migration; conflicts and deletion tombstones have an explicit policy. Diary snapshots remain independent. |
| Training | Retain the decorative training marker and static targets. Do not add expenditure to the budget from an activity marker. |
| Combos | Keep the name Combo for a reusable set. Add an optional scale at log time; retain fixed saved defaults. A recipe with cooked yield is a separate concept. |
| Manual entry | Add optional Log once for approximate entries; do not force every restaurant meal into the reusable library. Mark unknown nutrients absent and estimated figures as estimates. |

Each change should update its product specification/ADR in the implementing work. This proposal is not a silent override of existing behavior.

### Creative extensions after the core flow works

1. **“Your usual breakfast.”** Offer a saved Combo or recent meal based on explicit history, with its ingredients and amounts visible. Start with deterministic ranking, no AI requirement. A suggestion is always user-confirmed.
2. **Recipes with cooked yield.** Add ingredients, record total cooked weight or number of portions, then log 320 g of the finished dish. This solves batch cooking better than a fixed Combo. Preserve the recipe version and logged snapshot; surface ingredient incompleteness.
3. **Capture now, finish later.** Save a local photo or short note into a clearly separate Unfinished section. It contributes no invented calories. Convert it into a diary entry once reviewed. Useful when eating out or in a hurry.
4. **Text-assisted logging.** “250 g yoghurt, a banana and 30 g oats” becomes an editable multi-item preview with explicit food matches and quantities. Start with a constrained parser using existing foods; evaluate model assistance only where needed.
5. **Nutrition-label capture before meal-photo estimation.** A label provides quantities and a per-100 basis that can be reviewed. Meal-photo estimation adds unknown portion size and hidden ingredients, so introduce it as a separate experiment with review, correction effort and error measurements. Do not ship an AI button until the flow is useful.
6. **An honest weekly review.** Show logged-day coverage and user-marked complete days. Missing days are unknown, not zero-intake days. Offer factual summaries such as average logged protein; avoid judging incomplete logs or prescribing changes. This depends on effective-dated goals and persisted history.

Shopping lists, social feeds, streak pressure, a large recipe-discovery catalog, and automatic exercise-calorie compensation stay behind these priorities. They do less to improve the core logging task.

## Recommended implementation order

| Release | Deliverable | Dependencies / exit condition |
| --- | --- | --- |
| 1 — Clear and quick | QA-001 summary, QA-004 rows + sticky portion action, Add & continue, QA-005 styling | Existing models; first meal visible without unnecessary scrolling on a standard iPhone; log three foods in one browser visit. |
| 2 — Dependable daily use | Offline termination audit, durable operations if needed, repeat portions, Favorites/Recent, Copy meal, integrated Combos | User-scoped identity and deduplication first; copied or retried meal appears exactly once. |
| 3 — Goals and history | QA-002 editor, calendar jump, effective-dated goals, library backup/sync | Migration contract, restore verification, no silent rewriting of past comparisons. |
| 4 — Home cooking and imperfect days | Recipe yield, scaled Combos, Log once, capture-later drafts | Explicit snapshot/provenance extensions; useful even without AI. |
| 5 — Assistance and understanding | Label capture, text-assisted batches, weekly review; optional photo experiment | Evaluate against manual entry on representative Dutch foods; ship only if completion time improves without unacceptable correction work. |

Within release 1, build small separable changes: summary → result rows/portion sheet → continued logging. Extract components and shared snapshot creation only where the new flow needs them. Core owns arithmetic/ranking, mobile owns presentation and device storage, Convex owns authenticated durable history and batch validation. Reuse current tests for absent/trace values, fork precedence, snapshot preservation, import failure and accessibility.

### Concrete success criteria

Measure before/after on the same phone and dataset. Targets below are product hypotheses, not measured current results:

- A familiar single-food entry takes no more than three taps from Nutrition, with no keyboard when the portion is unchanged.
- A saved Combo takes no more than three taps from Nutrition.
- Three foods can be logged without leaving and reopening Add Food.
- Local search produces usable results within 150 ms on a representative supported phone; online time is measured separately.
- The new result row always states the calorie basis, and a pending operation never looks silently lost or synchronized when it is not.
- Changing a goal after the historical-goals release does not change yesterday's comparison.
- Backup/restore reproduces the same personal foods, Combo identities and logged totals.

Use observed task completion time and correction rate as primary measures. Do not collect food names, photos or free text merely to measure navigation speed.

## Verification pass

On an iPhone: start with no goals; log breakfast; choose an exact gram amount; add two more foods without restarting search; repeat breakfast on another day; scan a known and unknown barcode; cancel import; edit and move an entry; try missing/trace nutrition; lose connection during a save, kill the app, restore it and reconnect; verify no duplication. Repeat the main paths in Dutch with large text and VoiceOver. Check keyboard/footer overlap and Reduce Motion. After history/sync work, change goals, inspect yesterday, and restore the library onto another installation.

Run focused mobile/core/Convex tests appropriate to each release and the repository's required checks when implementing. No implementation tests were run for this document-only proposal.
