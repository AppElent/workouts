# Nutrition releases 3–5 — integration status

Implementation date: 2026-09-12. All work is in the existing `D:/Dev/workouts` checkout. No new worktree, commit, push or production deployment was performed.

## What changed

- Release 2 reliability follow-up: distinct valid client UUIDs without global crypto; immediate UI completion after durable local acceptance; online/foreground retry; pending-entry edit/delete targeting; account-switch isolation; stale query protection; visible pending/retry state; missing server receipts no longer trigger unsafe legacy writes in production.
- Release 3: progressive range-capable goals, effective-date history and offline goal cache; month calendar; opt-in account backup for Personal Foods and Combos, explicit legacy import, revision conflicts and deletion tombstones.
- Release 4: account-scoped device-local recipes with named versions, frozen ingredients and cooked yield; scaled recipe logging and Combo multipliers; direct estimated one-off logging; unfinished notes and retry-safe conversion into diary entries.
- Release 5: explicit English/Dutch g/ml text assistance with food selection and batch review; editable pasted label nutrition; weekly review of logged values, honest coverage and explicit day-completion markers.
- Navigation: secondary tools are grouped behind “More nutrition tools” and “Other logging options”; the main diary remains meal-focused. Alternate logging from Add Food retains its selected date and meal.

## Deliberate limits

- No photo/OCR label recognition or meal-photo calorie estimation. These remain experiments requiring provider/privacy decisions and accuracy evaluation; the text-label flow is not presented as photo recognition.
- Recipe and draft storage is device-only, account-scoped, and disclosed. Personal Food/Combo backup does not imply recipe backup.
- Library uploads run from the local outbox. Download/restore is explicit through the backup screen; do not describe this as continuous automatic two-way library synchronization.
- Weekly review reports synced diary values, warns about pending device operations, and is not medical advice or an estimate of true intake on incompletely logged days.
- No emulator or device visual verification, speed benchmark, two-physical-device acceptance run or production migration was performed.

## Automated evidence

- Shared core package build: passed.
- Root TypeScript: passed.
- Mobile TypeScript: passed again after all feature work was integrated.
- Full mobile Jest suite: 43 suites, 253 tests passed (final integration run).
- Root core/Convex/web tests: 35 files, 282 tests passed.
- Web production bundle and service-worker generation: passed. Build emitted browser-externalization warnings from existing TanStack server imports.
- Scoped Biome checks: parent integration files and completed agent-owned feature files checked separately. Repository-wide `pnpm check` cannot start because existing `.claude/worktrees/*/biome.json` files contain nested root configurations. Those unrelated worktrees were not changed.
- `git diff --check`: passed at integration checkpoint.
- A repeat Convex codegen run was rejected by the automatic approval reviewer because it can upload private source to the configured development backend. No workaround was attempted. The generated API already in the checkout is sufficient for local typechecks; deploying updated backend functions still requires the normal approved development/release workflow.

All four implementation agents finished. The final full-suite total is **535 passing tests** (253 mobile + 282 core/Convex/web). Scoped Biome passed across 79 changed TypeScript files. Root and mobile TypeScript both passed. These checks validate code behavior, not native visual quality or a deployed backend.

## Before accepting on-device

Use [VERIFY-ON-DEVICE.md](VERIFY-ON-DEVICE.md). Prioritize offline restart/retry without duplicates, account switching, two-device backup/conflicts/deletions, historical goal dates, recipe scaling and interrupted draft conversion. Test against an approved updated development backend before production rollout.
