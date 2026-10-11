# Nutrition account migration

Issue 89 makes account storage automatic. Read the [contract](../product/online-first-account-data.md)
and [branch evidence](../verification/online-first-account-data/README.md) before rollout.

## Server release gate

1. Select the intended deployment using the [environment](environment.md) and
   [worktree](worktree-setup.md) runbooks. The verification deployment
   `earnest-cobra-841` is isolated development, not production. Do not copy its key
   into a release environment.
2. Deploy the additive schema/indexes and `nutritionAccountMigration:backfill`
   before distributing the new client. Wait for index readiness. Existing writes
   populate library index fields and sourced strength-reference fields in the
   deployed functions. The merged strength implementation owns derived maxima;
   there is no separate account-data estimate index.
3. Dry-run **both** tables from a null cursor:

   ```sh
   pnpm exec convex run nutritionAccountMigration:backfill '{"table":"library","cursor":null,"dryRun":true}'
   pnpm exec convex run nutritionAccountMigration:backfill '{"table":"sets","cursor":null,"dryRun":true}'
   ```

   These are operator-only internal mutations. Use the selected deployment's
   normal authenticated CLI configuration; credentials do not belong in logs.
4. For each table, pass the returned `continueCursor` as the next `cursor` until
   `isDone` is true. Each invocation scans at most 100 rows. Record deployment,
   table, cursor, scanned/changed totals and completion. `changed` in dry-run means
   rows that would change; no rows are written.
5. Repeat from null with `dryRun:false`, saving each completed cursor. An
   interrupted page/cursor can be retried: only missing derived fields are
   patched. Library payloads, owners, revisions and tombstones are preserved.
   Sets keep their historical values and verification state. Reference fields
   are repaired from eligible, explicitly verified performance; unverified
   legacy rows are never promoted into measured or estimated evidence.
6. Run a complete dry-run again from null. Require zero changed rows and verify
   authenticated browse/search/barcode/fork lookups and latest/best Set reads.
   Complete this before distributing the account-first client: old library rows
   without derived fields are invisible to the new indexed browse. Current
   strength references continue to obey ADR 0013's verified-performance boundary.

If old clients or functions can still create rows without derived fields, repeat
the full check after their transition. Do not remove compatibility paths until
there is evidence that no eligible rows or supported legacy writes remain.
No production deployment or complete production backfill was performed by the
branch verification.

## Device migration

- Known-owner SQLite Foods/Combos and saved Capture Drafts upload automatically
  after that same account authenticates online. Pending legacy operations replay
  with their original stable IDs and receipt identities.
- Unowned libraries require **Upload local data** in Profile → Local data and
  library settings. The button also retries this account's pending library and
  diary changes and saved-note migrations. It shows remaining uploads and waits
  for server acknowledgement before reporting completion.
  Copies use stable `device:` IDs and rewrite Combo references. The original claim
  owner is recorded; another account cannot claim the same pending work.
- Preserve original records and journals until server acknowledgement. Interrupted
  claims resume missing records rather than recopying acknowledged or deleted ones.
  **Upload and clean local data** waits for all three upload owners, then removes
  acknowledged migration originals and diary caches with data providers unmounted.
  Pending or changed originals block cleanup. Stable claim/migration receipts,
  library mirrors (including local photo references), optional preferences,
  remembered portions and unfinished Set Drafts remain. Disposable caches can
  refill during ordinary use. Cleanup never deletes Convex account records.
- Conflicting legacy versions are retained as separate records automatically.
  A lower-schema legacy version cannot downgrade a newer account record; a deleted
  account record is not recreated. Keep any recovery copy linked to the migration
  receipt. Ordinary saves use last server acceptance rather than this legacy
  conflict handling.
- Local Food photos stay on their original device. Portable records omit photos
  and remain usable on a new installation. Local portions/recents are optional.
- Library settings exposes remaining legacy uploads and retry. Development
  builds also provide Profile → Labs → SQLite browser for read-only database,
  table and row inspection. Local rows can be already-acknowledged caches or
  retained originals; a nonempty table is not itself evidence of pending uploads.
  See [tool verification and the storage inventory](../verification/local-data-tools/README.md).
  A failure must
  retain the journal and originals. Resolve genuine invalid-record errors from
  retained evidence rather than discarding pending data.

Verify with two accounts, a legacy known-owner device, an unowned device, an
interrupted upload and conflicting server/local versions before a production
rollout. Public backend and repository/provider tests cover these contracts;
the branch simulator run did not create every historical legacy device fixture.
