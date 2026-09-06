# Personal Foods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person create, find, edit, delete, and log a device-local Personal Food while preserving immutable Convex diary snapshots.

**Architecture:** A synchronous `expo-sqlite` repository is the only persistence boundary. It owns `user_version` migrations, validation, UUID creation, and Personal Food queries; a React context exposes that boundary and a revision signal to the existing Nutrition browser. The browser merges Personal Foods ahead of promoted shipped foods and sends either kind through a shared serving preview, while Convex accepts a provenance-rich immutable snapshot.

**Tech Stack:** Expo 57, React Native 0.86, `expo-sqlite` synchronous API, Jest/Testing Library, Vitest/convex-test, TypeScript, Biome.

**Spec:** `C:/Users/ericj/orca/notes/spec-68/ticket-74.md`, with decisions in `C:/Users/ericj/orca/notes/spec-68/DECISIONS.md`.

## Global Constraints

- Use only `energy`, `protein`, `carbs`, `fat`, `saturatedFat`, `fibre`, `sugars`, and `salt`.
- Keep `{kind: "absent"}`, `{kind: "trace"}`, and `{kind: "value", amount}` distinct; absent never renders as zero.
- Use synchronous `expo-sqlite` directly, one repository boundary, and `PRAGMA user_version`; no query builder.
- Mint stable local UUIDs on device and retain them across edits and repository recreation.
- Store immutable diary snapshots in Convex; a Personal Food reference may dangle after source deletion.
- Limit a Personal Food to three ordered custom Servings, each with positive finite base-unit amount.
- Disclose second-device, uninstall-loss, and best-effort platform-backup behavior in English and Dutch.
- Do not touch diary edit/delete (#73) or training-marker (#78) code.
- Commit incrementally on `AppElent/nutrition-74-personal-foods`; do not branch, push, or open a PR.

---

### Task 1: Synchronous Personal Food repository

**Files:**
- Create: `apps/mobile/src/data/personal-food-repository.ts`
- Create: `apps/mobile/src/data/personal-food-repository.test.ts`
- Create: `apps/mobile/src/test-support/sqlite-test-database.ts`

**Interfaces:**
- Produces: `PersonalFood`, `PersonalFoodDraft`, `PersonalFoodRepository`, `createPersonalFoodRepository(database, options?)`, and `openPersonalFoodRepository()`.
- Repository methods: `list()`, `find(id)`, `search(query, locale)`, `create(draft)`, `update(id, draft)`, and `remove(id)`.

- [ ] Write a public-behavior test proving creation returns an RFC 4122 UUID, preserves all nutrient states and three Servings, rejects a fourth Serving/negative nutrient/zero Serving, and keeps zero distinct from absent.
- [ ] Run `pnpm --filter @workouts/mobile test -- personal-food-repository.test.ts --runInBand`; verify the test fails because the repository does not exist.
- [ ] Implement the v1 `user_version` migration, JSON serialization, validation, UUID minting, and CRUD/search methods using only synchronous database calls and bound parameters.
- [ ] Re-run the focused test and verify it passes.
- [ ] Add failing tests proving edits retain the id, deletion removes lookup/search results, repository recreation sees prior data, and an already-v1 database remains readable.
- [ ] Implement only the behavior needed by those tests, re-run them green, then run mobile typecheck.
- [ ] Commit repository and tests with a WHY-focused message and the required co-author trailer.

### Task 2: Personal Food provider and authoring behavior

**Files:**
- Create: `apps/mobile/src/data/personal-foods.tsx`
- Create: `apps/mobile/src/screens/personal-food-editor.tsx`
- Create: `apps/mobile/src/screens/personal-food-editor.test.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx`
- Modify: `apps/mobile/src/test-support/render-app.tsx`
- Modify: `apps/mobile/src/i18n/messages/en.ts`
- Modify: `apps/mobile/src/i18n/messages/nl.ts`

**Interfaces:**
- Consumes: the Task 1 repository.
- Produces: `PersonalFoodsProvider`, `usePersonalFoods()`, and `PersonalFoodEditor` callbacks `onSaved(food)` / `onCancel()`.

- [ ] Write screen tests for bilingual names, base unit, all three nutrient-state choices, value zero, up to three bilingual Servings, visible validation, retained input on repository failure, pending save state, and English/Dutch device-only disclosure.
- [ ] Run the focused editor test and verify it fails because the editor/provider do not exist.
- [ ] Implement the provider revision mechanism and editor form with accessible labels/roles, value inputs only for `value` nutrients, inline validation, toast errors, and a loading Save button.
- [ ] Re-run focused tests and mobile typecheck; fix only production behavior until green.
- [ ] Commit the independently usable authoring slice with the required trailer.

### Task 3: Ordinary search, edit/delete, and serving preview

**Files:**
- Modify: `apps/mobile/src/screens/nutrition-food-browser.tsx`
- Modify: `apps/mobile/src/screens/nutrition-food-browser.test.tsx`
- Modify: `apps/mobile/src/test-support/render-app.tsx`
- Modify: `apps/mobile/src/i18n/messages/en.ts`
- Modify: `apps/mobile/src/i18n/messages/nl.ts`

**Interfaces:**
- Consumes: `usePersonalFoods()`, `PersonalFoodEditor`, and the existing shipped search/serving flow.
- Produces: one ordinary search result list that ranks Personal Foods before promoted Shipped Foods and a shared preview that scales either source without rounding stored values.

- [ ] Write failing router tests that create a Personal Food, find it via ordinary local search, preview a custom Serving, edit it without changing the UUID, and delete it through `useConfirm()` using a verb-specific action.
- [ ] Run the focused browser tests and verify the new cases fail for missing behavior.
- [ ] Merge repository search results with promoted shipped results, add create/manage actions and disclosure, and generalize the local preview path to all eight Personal Food nutrient states.
- [ ] Re-run the focused tests; verify empty and repository-failure states are explicit and accessible in both locales.
- [ ] Commit the search/manage slice with the required trailer.

### Task 4: Immutable Personal Food diary snapshots

**Files:**
- Modify: `convex/nutritionDiaryModel.ts`
- Modify: `convex/nutritionDiary.test.ts`
- Modify: `apps/mobile/src/screens/nutrition-food-browser.tsx`
- Modify: `apps/mobile/src/screens/nutrition-food-browser.test.tsx`

**Interfaces:**
- Consumes: the Personal Food serving preview and existing `nutritionDiary.log` mutation.
- Produces: diary provenance supporting shipped and personal origins while preserving the current shipped payload contract.

- [ ] Add a failing convex-test case that logs a Personal Food snapshot, changes/deletes the source only in the device repository, and proves the Convex day still renders the original label/Serving/nutrients and totals absent/trace/value correctly.
- [ ] Add a failing mobile router test asserting the Personal Food log payload contains its stable `sourceId`, manual nutrition provenance, bilingual snapshot, unrounded scaled figures, date, and meal, with duplicate presses suppressed and failure retaining input.
- [ ] Expand the validator provenance union and submit the Personal Food snapshot from the existing serving action.
- [ ] Run focused Convex and mobile tests until green, then run root typecheck.
- [ ] Commit the snapshot integration with the required trailer.

### Task 5: Full verification and real Android flow

**Files:**
- Modify only files required by defects reproduced during verification, with a failing test first.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: evidence for every ticket checkbox and all four required gates.

- [ ] Run fresh `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm --filter @workouts/mobile test`; retain exact exit status and test counts.
- [ ] Confirm `git diff --check`, inspect `git status`, verify no `.env*` or secrets are staged, and review every changed file against ticket #74.
- [ ] Start Expo on an unused port other than occupied 8081/8082, configure `adb reverse`, then begin device automation with `agent-device open <app> --foreground`.
- [ ] Use `snapshot -i`, click/fill, and `wait text` to create a bilingual Personal Food with a custom Serving, find it in ordinary local search, log it to a meal, and confirm the Diary Entry is visible.
- [ ] Close the device session and make a final corrective commit only if verification exposed a tested defect.
