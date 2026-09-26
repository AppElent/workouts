# Shipped exercise catalog

The catalog combines 54 curated entries in `exercises.ts` with 618 imported
entries in `wrkoutExercises.ts` (672 total). Curated names and metadata stay
unchanged so existing exercise IDs, routines, and workout history remain valid.

## Source and scope

Imported text comes from [wrkout/exercises.json](https://github.com/wrkout/exercises.json)
at revision `5994bea047eee4d39a2c0872be3dd8fdd258ba31`, released into the public
domain under the Unlicense (copy in `wrkout-LICENSE.txt`). No images are imported.
The generated file is bundled locally; browsing exercises needs no GitHub access.

Of the source's 873 entries, we include strength, powerlifting, Olympic
weightlifting, and strongman movements with instructions. Cardio, stretching,
and plyometrics are outside this strength catalog. Five otherwise eligible
entries have no instructions and are skipped. Exact names, punctuation-only
variants, and explicit aliases of curated exercises are deduplicated. Distinct
equipment, grip, stance, and range-of-motion variants remain separate.

The importer maps body only → bodyweight, kettlebells → kettlebell, bands → band,
and e-z curl bar → barbell. Unsupported or unspecified equipment maps to other.
Abdominals map to core; lats and middle back map to back. Primary muscles remain
first, followed by secondary muscles, without duplicate groups. Three movements
with missing mechanics have explicit classifications in the importer. Instructions
are retained from upstream; weight increments use the app's equipment defaults.

## Regenerating

Clone the source, check out the pinned revision, then run from this app:

```sh
git clone https://github.com/wrkout/exercises.json /tmp/wrkout-exercises
git -C /tmp/wrkout-exercises checkout 5994bea047eee4d39a2c0872be3dd8fdd258ba31
pnpm exec tsx scripts/import-exercises.ts /tmp/wrkout-exercises
```

Review metadata mappings and aliases when deliberately updating the pinned
revision. The script rejects an unexpected revision or unmapped metadata.

## Runtime and rollout

`@workouts/core/exercises` is a separate web/mobile bundle entry. Permanent keys
live in `ids.json`; preserve them when editing names or updating upstream data.
The generator requires an explicitly assigned ID for every imported name.

No exercise seeding is required on a fresh database. Sets, routines, personal
records, and hosted workouts store shipped keys directly; only personal exercises
are stored in the exercises table. Backend validation reads the same bundled data.

For an existing deployment, use the checkpointed reference migration described
in `docs/exercise-migration.md`. Deploy the backend, run a dry run, then apply and
verify the migration before releasing updated clients. The backend supports
mixed references during the rollout. Personal exercise IDs are never rewritten.

`pnpm seed:exercises` is now a no-op retained for older setup scripts. It does not
migrate history and never inserts default exercises.

See `docs/adr/0009-shipped-exercise-catalog.md` for the identity/rollout trade-off.
