# Release 3 — personal library backup/sync checkpoint

## Scope

This bounded slice backs up and restores Personal Foods and fixed Combos only.
Diary entries remain immutable snapshots and are never read, rewritten, or
deleted by library synchronization.

## Parent integration contract

1. `nutritionLibraryTables` is now composed by the parent schema and generated
   API types include the public `nutritionLibrary.list` and
   `nutritionLibrary.applyOperation` functions.
2. The existing `PersonalFoodsProvider` remains the app wrapper. No layout or
   global i18n changes are required by this slice. Add the new
   `nutrition-library` Stack screen and a discoverable entry point during final
   integration.
3. Test injection contract:
   `<PersonalFoodsProvider repository={foodRepository} libraryState={libraryState}>`,
   where `libraryState` comes from
   `createNutritionLibraryStateRepository(new SQLiteTestDatabase())`. Supplying
   only `repository` intentionally leaves backup disabled and never opens native
   SQLite.

## Server tables

- `nutritionLibraryRecords`: one account-owned record per stable food/combo ID,
  with a monotonically increasing revision and retained deletion tombstone.
- `nutritionLibraryOperationReceipts`: per-account immutable retry receipt.

Every server operation checks Clerk's subject, uses `(userId, recordId)` or
`(userId, operationId)` indexes, and rejects a mismatched expected revision.

## Client policy

- The legacy `workouts-nutrition.db` remains unclaimed until the person
  explicitly confirms **Import this device library**.
- Enabled accounts use a separate subject-derived SQLite food database plus a
  subject-scoped sync-state/outbox database. Switching accounts opens only that
  account's database; nothing is copied automatically.
- Local acceptance occurs first. Each remote write has one durable operation
  UUID and reuses it on retry. Tombstones are retained locally and remotely.
- On concurrent edits the service stores both payloads as a conflict. It never
  uses timestamp last-write-wins: the person chooses **Keep this device copy**
  (rebased write) or **Use server copy**.
- The account state database writes a prepared journal row before changing the
  separate account food database. Startup recovers a completed local write into
  the outbox. A post-write journal failure keeps that prepared row.
- Creating a service does local recovery and seeds only pre-existing records
  from that account's already-isolated library. Network transport starts only
  after the provider observes a live Convex connection; discarded renders and
  offline construction never send a mutation.
- Once an account claims the legacy device library, every other account opens
  its own empty account-scoped library; the claimed legacy database is neither
  displayed nor importable for it.
- If Account B creates records in that isolated library before enabling backup,
  enabling queues those existing Account B records. It never treats them as a
  legacy import and never silently leaves them unbacked.
- Remote download is an explicit manual restore when the library screen opens
  or the person chooses **Restore latest library**. That action restarts page
  one even when already there; an apply failure remains retryable. Background
  replay uploads only local outbox operations.
- Incoming server metadata is committed only after the separate account food
  database applies successfully. Acknowledging an older operation preserves a
  later local payload or tombstone and rebases it. Choosing the local conflict
  copy clears stale work, conflict, and replacement queue atomically.

## Focused verification

- `pnpm test -- convex/nutritionLibrary.test.ts` — 2 passed.
- `pnpm --filter @workouts/mobile test -- nutrition-library-service.test.ts personal-foods.test.tsx personal-food-repository.test.ts` — 34 passed.
- `pnpm --filter @workouts/mobile typecheck` — passed.
- `npx biome check <owned TypeScript files>` — passed.
- `git diff --check` — passed.

## Current owner files

`convex/nutritionLibrary*.ts`, mobile personal-food repository/provider,
`apps/mobile/src/data/nutrition-library*.ts`, the nutrition-library screen and
route, and their focused tests.
