# Migrate history to shipped exercise IDs

This migration rewrites `exerciseId` in sets, one-rep max records, routine entries,
and hosted-workout strength blocks. Only references to default exercises change.
All other values and document IDs remain intact, including hosted movement names
and instructions. Personal exercises with matching names are not defaults.

Take a deployment export before applying any data migration. Use the same intended
Convex environment for every command below; append `--prod` only when deliberately
running against production. Do not import historical data or run older seed code
while this migration is in progress.

1. Deploy the updated backend. Readers support mixed old/new references and old
   client writes are canonicalized immediately.
2. Run the read-only preflight (it writes only migration progress metadata):

   ```sh
   pnpm exec convex run exerciseMigration:start '{"dryRun":true}'
   pnpm exec convex run exerciseMigration:status
   ```

   Work is scheduled in pages of 100 documents (configurable `batchSize`, 1–200).
   Check status until `phase` is `complete`. Review `mappedExercises`, `scanned`,
   and `changed`; counts are documents, not individual nested reference fields.
   `dryRun: true` means training data has not been modified.
3. Apply, then check completion:

   ```sh
   pnpm exec convex run exerciseMigration:start '{"dryRun":false}'
   pnpm exec convex run exerciseMigration:status
   ```

   Success is **`phase: "complete"` and `dryRun: false`**. This includes a second
   scan of all four tables; every `verify:*` changed count must be zero. A returned
   ID from `start` only means the job was scheduled, not that it has finished.
4. Release the updated clients. They load shipped exercises directly from the
   application bundle and query only paginated personal exercises.

## Resume and failures

If scheduling was interrupted, continue from the last committed page:

```sh
pnpm exec convex run exerciseMigration:resume
pnpm exec convex run exerciseMigration:status
```

The cursor and each page's edits commit together. Repeated `resume` calls are safe,
and starting an already completed apply run is a no-op. Stale scheduled callbacks
from a previous dry run cannot affect a newer run.

If `phase` is `blocked`, inspect `error`. Unrecognized default names are detected
before references are touched. Reconcile the default with the shipped catalog
(or explicitly pin a verified `shippedExerciseId` on that default record), then
start a new dry run. Never map by a user's exercise name or invent a correspondence.
Verification failures also block completion; inspect for writers bypassing the
updated backend, then restart. Rewritten pages are idempotent and mixed references
remain readable while a run is incomplete.

The migration retains old default documents for bookmarked links and cached IDs;
it pins their shipped targets and clears its temporary mapping on completion.
No normal catalog read depends on those documents. Removing them is deliberately
outside this migration so old links remain valid.

Fresh databases need no exercise seeding. `pnpm seed:exercises` remains a no-op
for existing setup scripts; it is not this migration command.
