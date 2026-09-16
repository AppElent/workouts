# Capture Drafts in the Nutrition Diary

## Objective

Make Capture Drafts (the "unfinished logs") fast to create and fast to resolve. A Capture Draft is a note about intake placed in the Nutrition Diary under its date and Meal Slot; it does not count as intake until converted into Diary Entries. See `CONTEXT.md`.

Read `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, and `docs/adr/0005-local-first-nutrition-with-durable-history.md` before editing. Mobile only — the web app has no nutrition diary.

## Current state (to be replaced)

- Drafts are persisted in `nutrition_capture_drafts` inside `apps/mobile/src/data/nutrition-cooking-repository.ts`, a recipe module they do not belong to.
- The only UI is `apps/mobile/src/screens/nutrition-cooking.tsx` (`draft-new` / `draft-edit` / `draft-log` modes), reached via the day-screen overflow menu → "Recipes and unfinished logs" → "Capture note". The food browser's collapsed tools menu has a "Capture later" item that navigates there with an empty note.
- Resolving a draft opens a full one-off entry form (name EN/NL, amount, unit, every nutrient). There is no path from a note to the Food Library.

## Agreed behaviour

1. **Placement.** A draft renders inline in the day screen under its Meal Slot, visually distinct from Diary Entries, with a subtle "on this device" hint. It never contributes to totals or goal progress.
2. **Create.** In the food browser (`/nutrition-food?meal=&date=`), a "Save as note" action is available whenever the search field has text, and in the empty-results state. It stores the search text verbatim as the note for the current date + meal, then pops back to the day screen. No success toast — the note appearing in the diary is the confirmation. The "Capture later" menu item is removed.
3. **Resolve.** Tapping a draft row opens the food browser for the draft's date + meal with the note prefilled as the search query. The browser's existing menu (Log once / New personal food / Text & nutrition label) covers the no-match case; no chooser screen.
4. **Removal.** When a resolving browser session ends (user navigates back) with at least one Diary Entry logged for that date + meal during the session, the draft is removed. With zero entries logged, the draft stays. This makes single-item and multi-item notes ("pasta, salad, bread") both work without extra prompts.
5. **Row actions.** The draft row uses the same actions-sheet pattern as entry rows (`t.nutrition.entryActions`): Edit text, Change meal, Delete. Tap remains the fast path (resolve).
6. **Cross-day banner.** When drafts exist on dates other than the one shown, the day screen shows a one-line banner ("N unresolved notes on earlier days") that navigates to the oldest such date.
7. **Weekly review.** Each day shows its draft count. Marking a day complete while drafts exist asks for confirmation (verb-specific label) but is allowed — a Complete Day is a claim about intake and a draft is not intake. `nutritionReview.toggleComplete` is unchanged; the count is read locally.
8. **Cooking screen.** Becomes recipes-only: remove the `draft-*` modes, the Unfinished list, the draft copy; the header-menu label becomes "Recipes" (en) / "Recepten" (nl). Its footer disclosure about device-only drafts moves to the draft row hint.
9. **Storage.** Drafts stay device-only (ADR 0005 unchanged). Move the draft table and its repository out of the cooking repository into a dedicated diary-side local store (e.g. `nutrition-draft-repository.ts`), keeping the same SQLite table so existing rows survive. Drop the `conversion_client_entry_id` / `conversion_operation_id` columns from the domain type; rule 4 no longer needs per-entry conversion tracking. Leave the columns in SQLite (nullable, unused) rather than migrating.

## Out of scope

- Syncing drafts across devices.
- AI parsing of a note into multiple entries.
- Blocking Complete Day on unresolved drafts.
- Any web (`src/`) or Convex change.

## Verification

- Repository tests for the new draft store (create / list by date / list other-day count / update / remove).
- Screen tests: draft row renders under the right slot and is excluded from totals; "Save as note" creates a draft and pops back; resolving with ≥1 logged entry removes the draft, with 0 keeps it; cross-day banner count and navigation; weekly-review confirm on complete-with-drafts.
- Existing cooking-screen tests updated for the removed modes.
- `pnpm typecheck`, `pnpm test`, `pnpm check` green; drive the flow on the emulator per the `verify` skill before claiming done.
