# Local data upload and SQLite inspection

## Current status

2026-10-08, working changes on `t3code/offline-behavior-decision`, based on
`fa297f2`, alongside the subscription cache pilot. Verified on iPhone 18 Pro,
iOS 27.0, dedicated simulator `Workouts Query Cache 3be9d410`, bundle
`com.appelent.foundry`, this checkout's Metro on port 8190, isolated development
backend `earnest-cobra-841`. No normal-development or production/preview rollout
was performed for these additions. The owner's physical phone was not modified.

## Actions

Profile → **Local data and library settings** → **Upload local data**:

- Claims this device's eligible unowned legacy Foods/Combos for the signed-in
  account, using the existing stable `device:` identities and rewritten Combo
  references. Known-owner records remain limited to their original account.
- Retries pending library and diary migration journals and saved Capture Drafts.
  Shared completion promises join uploads already running automatically.
- Displays pending counts, disables repeat submission while uploading, reports
  completion only after all three owners acknowledge their pending work, and
  retains originals and journals after failures.
- Does not re-upload arbitrary cached query results, device preferences, Food
  photos or unfinished editor/Set input. Training saves already use Convex.
  Completion applies to eligible saved records for the current account; it is
  not permission to discard another account's local records or unsaved input.

Profile → **Labs** → **SQLite browser**, development builds only (`__DEV__`):

- Lists existing Workouts databases and `ExpoSQLiteStorage`; it does not create
  a missing database or run a repository migration.
- Lists tables with row counts and columns. Shows 25 rows per page in primary-key
  order; each row expands into selectable JSON. Refresh rereads current data.
- Opens an independent connection with `PRAGMA query_only = ON`, closes it after
  each inspection, and exposes no editing or arbitrary-SQL control. Production
  bundles hide the entry point and reject inspection if the route is opened.

## SQLite inventory

Tables depend on which historical versions this installation has used. The
browser lists the actual files and tables; this inventory describes their owners.

| Database | Stored contents | Upload meaning |
| --- | --- | --- |
| `ExpoSQLiteStorage` | Language, appearance, other optional device preferences, and persisted Set Drafts | Device convenience/unfinished input; not saved account records |
| `workouts-nutrition.db` | Original legacy `personal_foods` and `nutrition_combos`; bounded `off_cache` for Open Food Facts responses | Legacy library can be claimed/uploaded; external request cache stays local |
| `workouts-nutrition-library-<account>.db` | Account-scoped `personal_foods` and `nutrition_combos` read copies | Already-acknowledged copies are disposable; untracked legacy account records are journaled by the existing migration owner |
| `workouts-nutrition-library-state.db` | `nutrition_library_records`, pending `nutrition_library_operations`, crash recovery `nutrition_library_prepared`, retained `nutrition_library_conflicts`, `nutrition_library_legacy_claim`, legacy `nutrition_library_settings` | Receipt/revision/tombstone and migration evidence; keep until migration is verified |
| `workouts-nutrition-state.db` | `nutrition_cached_days`, `nutrition_cached_goals`, cached personal measures and supplementary servings, `nutrition_food_shortcuts`, `nutrition_goal_preferences`, `nutrition_operations`, `nutrition_entry_mappings` | Read snapshots/defaults are local conveniences; non-acknowledged old diary operations are uploadable |
| `workouts-nutrition-cooking.db` | Original `nutrition_capture_drafts`, `nutrition_capture_draft_migrations`; historical Recipe tables and migration account/ID maps when present | Known-owner saved notes migrate; originals and migration evidence remain |

The subscription helper's 30-second cache is in memory and will not appear here.
Portable Food records omit device photo files, which are stored outside SQLite.

## Verification

- Mobile Jest: 94 suites, 618 tests passed. Added public save/service checks for
  joining an existing upload, waiting for acknowledgements, retrying the same
  migration identity, immediate diary retry and account isolation. Existing
  migration/error/save tests remain passing.
- Mobile typecheck, Biome, mobile architecture and iOS Hermes export passed.
  Existing SDK patch-update notices remain separate dependency maintenance.
- Native: opened the tools from Profile settings and Labs; read actual database
  lists, table counts and cached diary JSON; inspected empty/populated tables;
  verified refresh, row disclosure, and disabled single-page controls.
- Seeded one disposable legacy Food on this dedicated simulator, pressed Upload,
  and independently queried Convex to verify `device:qa-manual-upload-20261008`
  existed at revision 1. A repeated button press left zero pending library
  uploads, the acknowledged local revision stayed 1, and the original remained.
  [Verification details](upload-verification.json), [completion screenshot](upload-complete.png).
- Dutch/light and English/dark with extra-large system text were exercised.
  [Database list](databases-dark-xl.png), [table counts](legacy-tables.png),
  [expanded original row](original-row.png).

Native upload failure/offline paths, a table larger than 25 rows, Android, a
physical device and release-build route rejection were not exercised in this
pass. Save failure/retry/ownership are covered by automated public interfaces;
those checks do not substitute for the remaining native scenarios.

## Main/test-data integration — 2026-10-11

Integrated main's #99 before rollout. Account maintenance owns provider remounting
and the subscription cache boundary. Load/Clear also remove the current owner's
claimed legacy sources, Recipe sources and Set Drafts, preventing re-import after
reset. Production still rejects test-data reset; preview TestFlight currently uses
the production backend and consequently has no test-data reset controls.

**Upload and clean local data** first joins all three acknowledged upload owners.
Only then does it unmount providers and prune migrated originals, acknowledged
diary journals/mappings, and diary/goals/measures/servings caches. It leaves library
mirrors/revisions with photo references, claim/migration receipts, optional portion
preferences, Set Drafts and login intact. SQLite is intentionally not an empty
file after cleanup, and disposable caches refill during normal use.

Four new repository behavior tests were observed red then green: unchanged note
ACK cleanup; pending diary cleanup rejection; claimed-library ACK gating; and
Recipe source cleanup without cross-account deletion or resurrection. Combined
checks: 94 mobile suites / 622 tests, 62 root suites / 450 tests, both typechecks,
Biome/architecture, web build and iOS Hermes export passed. Expo Doctor reports
one existing SDK patch-version check (11 recommendations); versions were retained
for compatibility with the installed TestFlight runtime.

Native verification used the dedicated iOS 27 QA simulator and isolated deployment
`earnest-cobra-841`. In-app cleanup removed the previously uploaded legacy Food,
cleared diary/goals caches, retained preferences/library mirror, and returned to
existing online training history. In-app Load then Clear displayed the synthetic
baseline followed immediately by empty Home and Nutrition views. No prior query
result appeared on re-entry. Read-only counts are recorded in
[before cleanup](cleanup-before-2026-10-11.json),
[after cleanup](cleanup-after-2026-10-11.json), and
[after test-data clear](reset-after-2026-10-11.json).

Physical-device SQLite cleanup remains a separate acceptance action: use the
new button on that installation after the preview update is active. These
simulator counts do not describe the physical device's database.
