# Ship the exercise catalog and migrate historical references

Default exercises ship in `@workouts/core/exercises`, a separate package entry
used by web, mobile, and backend validation. Personal exercises remain in Convex.
Clients combine the bundle with paginated personal exercises. Neither the shipped
catalog nor an ID mapping is fetched during normal browsing. The trade-off is a
larger application bundle and catalog updates requiring an app release.

Shipped references use permanent application keys recorded in
`packages/core/src/exercises/ids.json`, never keys generated at runtime from names.
Sets, personal records, routines, and hosted templates store these keys directly.
Personal exercises keep their Convex document IDs. Write boundaries resolve
shipped keys against the catalog and check ownership of personal references.

Existing deployments have historical references to seeded default exercise
records. An operator-run migration replaces only those reference fields with
shipped keys. It preserves document IDs, timestamps, ownership, measurements,
record classifications, and hosted text snapshots. Multiple seeded defaults for
the same movement converge on the same key; personal exercises with the same name
are unaffected. Unmapped defaults block migration rather than being guessed.

The migration has a read-only dry run, bounded pages, transactional checkpoints,
a resume command, and a verification pass. Apply mode reports completion only
after all four reference-bearing tables have been checked for old references.
During rollout, readers combine old and new references and normalize returned
IDs; writers immediately canonicalize old-client inputs, including duplicated
sets and routine starts. Clients never have to manage that transition.

Old default documents are retained solely for existing links and cached inputs,
with their target key pinned after migration. Normal browsing does not read them.
The migration's temporary ID map is cleared on completion; only small progress
and count metadata remains. Removing legacy link support is a separate future
compatibility decision, not part of migrating training history.

We rejected a permanent client-side compatibility map: it would keep normal
browsing dependent on deployment-specific IDs and a backend catalog read. We also
rejected lazily creating default documents on first use: it would make immutable
catalog identity depend on database writes again.
