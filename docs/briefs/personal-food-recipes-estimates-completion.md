# Personal Food, Recipe, and Nutrition Estimate implementation

The shared Personal Food interface normalizes legacy inputs to ordinary classification,
per-100 nutrition in the existing unit, and no estimate. It owns validation, serving
choices, and conversion into immutable Diary snapshots. Per-serving foods use a real
`serving` unit and a bilingual serving name; no weight is invented.

Recipes are Personal Foods selected by classification in the food browser. They use
the shared editor and logging sheet. The estimate switch is independent of category
and provenance. Assisted estimates remain proposals until the person reviews and
saves them; logging is a subsequent explicit action. Diary rows display a compact
estimate symbol and announce “Estimated nutrition.” Copy, move, quantity edits,
Combo logs, offline reconciliation, and weekly review preserve the snapshot marker.

## Storage and rollout

- The additive Convex schema/functions were deployed to production
  (`fine-akita-444`) on 2026-09-16 after fixing a stray leading replacement
  character in `convex/nutritionEstimates.test.ts` that caused TypeScript TS1490.
  Both `pnpm exec convex deploy --dry-run -y` and the actual deployment passed,
  including schema validation. The mobile client has not been released.
- New Personal Library writes use payload schema version 2. Existing rows and
  outbox operations remain readable. Old pending operations retain their original
  wire envelope for receipt replay. A version-1 overwrite or restore cannot replace
  a version-2 record; tombstones retain the version.
- SQLite upgrades Personal Foods in place, preserving IDs and timestamps. Backup,
  restore, conflict choices, provider refresh, and tombstones retain the new fields.
- Each account migrates only its own legacy Recipe rows into its account library.
  IDs are preserved unless they collide with a food, Combo, tombstone, or reserved
  legacy identity. Durable ID mappings allow interrupted migration to resume.
  Completion markers prevent a deleted migrated food from being recreated.
- Gram yields become per-100-g nutrition; portion yields become per-serving
  nutrition. Version names become descriptions. If any ingredient lacks a nutrient,
  that aggregate is conservatively unknown; trace-only totals remain trace.
  Classification alone does not imply estimation.
- Legacy Recipe source rows remain untouched for a later cleanup release. Active
  Recipe CRUD, batch logging, ingredient models, and obsolete tests are removed.
  The cooking repository now persists only device-local Capture Drafts.
- Before explicit legacy claim, the existing unclaimed device library remains
  visible alongside account-isolated migrated foods. Combos containing those
  account foods stay in the account database. Backup remains opt-in; enabling it
  queues migrated foods through the usual outbox. A legacy import retains migrated
  account records and their IDs.

## Screen contract and device acceptance

The Recipes tab finds prepared dishes and opens the ordinary serving sheet; its
primary creation action opens the shared Personal Food editor with Recipe selected.
The editor reviews identity, category, basis, and precision before Save. Cancel
returns without persistence. Estimate assistance opens that same review before
offering a separate log action. Existing form, stack, loading, empty, validation,
and storage-error patterns remain in use. The Diary keeps its existing entry-edit
action and adds only a small estimate symbol beside the name, with wrapping for
long names and an accessible row label.

Automated coverage includes real SQLite migration/restart, account isolation,
interrupted migration and outbox replay, conflict/tombstone round-trips, per-serving
arithmetic and nutrient states, current-food Combo resolution, immutable Diary
history, proposal review, actual navigation destinations, and accessible icon size.

Final automated checks passed:

- `pnpm check` (no duplicate-root configuration collision in this worktree).
- `pnpm typecheck` and `pnpm --filter @workouts/mobile typecheck`.
- `pnpm test`: 36 suites, 295 tests.
- `pnpm --filter @workouts/mobile test -- --runInBand`: 50 suites, 307 tests.
- `pnpm build`: production client/server bundle and service worker generated.

The build emitted browser-externalization warnings. Mobile tests
also emitted a navigation `GO_BACK` warning in the nutrition-goals suite;
the suite passed. No tests or lint configuration were weakened.

Device verification was attempted with `agent-device open com.appelent.foundry
--platform android --foreground`; it reported `DEVICE_NOT_FOUND: No devices found`.
Physical-device visual acceptance remains outstanding. On the Android emulator
and physical iPhone, inspect the shared editor and Recipes serving sheet in English
and Dutch, including Dynamic Type XL, keyboard dismissal, safe areas, validation,
and storage errors. Save a serving estimate, log/copy/move/edit it, and check that
the small icon remains accessible without adding a day-total warning.
