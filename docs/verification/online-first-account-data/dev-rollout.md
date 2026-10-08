# Regular development rollout — issue 89

## Current status

2026-10-08: local `main` contains the combined implementation at `36a7994`.
It incorporates the app redesign / sourced strength references, Sentry triage,
and agent-guidance restructuring. Regular Convex development
`colorless-sturgeon-704` was deployed from `/Users/ericjansen/Developer/workouts`.
User testing is pending. Production (`fine-akita-444`) and the EAS preview app
have not been updated by this rollout.

Metro runs from normal main's `apps/mobile`, using its normal `.env.local`, on
8189. The task worktree retains its isolated environment. QA uses only the
`Workouts Online 3be9d410` iPhone 18 Pro simulator, iOS 27.0,
`0C88AD53-63AF-4886-854E-5D39C4CC1842`, bundle `com.appelent.foundry`, native
runtime `3720fa5dde1b2d8bf1948b572edf25e2bb1f2f41`.

## Integration and checks

- Diary retains account-note loading feedback and main's delayed incomplete-day
  feedback, avoiding a premature offline warning.
- Strength history uses main's verified-performance/source-reference model.
  Index repair never promotes unverified historical performance. `estimatedMax`
  is optional compatibility data only; there is no parallel maximum owner.
- Latest performance orders by `loggedAt`, including late-imported records,
  and uses the canonical exercise alias boundary. Excluding the current session
  skips that session's newer rows; this cost scales with those rows, not total
  history. Previous-session reads fetch only that session/exercise.
- The online-first decision is ADR 0014; main retains ADRs 0012 and 0013.

| Gate | Result |
| --- | --- |
| Root Vitest | 61 suites, 445 tests pass |
| Mobile Jest | 93 suites, 609 tests pass |
| Root and mobile typechecks | Pass; Expo regenerated stale route types after merge |
| Root build | Pass |
| Biome / mobile architecture | Pass, 673 files |
| Isolated Convex deployment | Pass with merged indexes and functions |
| Regular dev Convex deployment | Pass, indexes ready |
| Standards and specification reviews | No material remaining findings |
| Later documentation integration | Conflict resolved; checks pass; no application code changes |

## Migration gate

Full paginated passes on `colorless-sturgeon-704`, before simulator writes:

| Pass | Library scanned / changed | Sets scanned / changed |
| --- | --- | --- |
| Dry-run | 0 / 0 | 245 / 0 |
| Apply | 0 / 0 | 245 / 0 |
| Verify dry-run | 0 / 0 | 245 / 0 |

Every pass started at a null cursor and reached `isDone`; Sets required three
pages. Operator journal: `/tmp/issue89-normal-dev-migration.json` on the rollout
machine. Existing records were not reseeded or replaced. An empty account
library is expected before device-only legacy libraries upload or are claimed.

## Simulator acceptance

Dutch, initially light/default text. A fresh QA installation prevented the
isolated deployment's device cache from being imported into regular dev.
Existing Home activity history and Training routines loaded from normal data.

- Logged Appel × 1 (130 g), 73 kcal, then saved `QA 89 regular dev note`.
  The diary showed one food item and an account-owned note. Both reloaded after
  native process termination/relaunch. See [diary](dev-diary.png) and
  [restart](dev-restart.png).
- Created `QA 89 dev verification`, added Barbell Bench Press, and opened Set 1.
  Prior input populated 90 kg × 8; no logged performance existed until explicit
  logging. Logging produced one Set and 720 kg volume. Completion and reopening
  after restart preserved the summary. See [completed session](dev-strength.png).
- Deleted only the QA workout and its Set, then the QA note and apple entry,
  using normal UI confirmations. Home returned to the original history and the
  day's diary returned to zero kcal with no note badge.
- Created `QA 89 account Food` through the Food editor. The account Library
  displayed exactly one item after server acknowledgement. Uninstalled and
  reinstalled the QA app again, eliminating the local Food database: the same
  account Food loaded and reopened from the server. Dark appearance and XL text
  remained readable; see [fresh library](dev-fresh-library.png). Deleted the QA
  Food through its confirmation dialog, returning Library to zero visible items.
  Original data was preserved throughout.

The [original branch evidence](README.md#runtime-coverage) separately covers
transport loss, preserved input and successful retry without duplicates, Combo
rename keyboard behavior, and web workout editing. Those observations are dated
pre-integration evidence; the merged automated suites cover those contracts.
A full locale/theme/accessibility matrix, physical haptics, all historical
migration fixtures on real devices, and production/preview delivery are not
established by this dev smoke run. The existing exercise picker and workout
summary still contain English copy in the Dutch flow; that localization gap is
outside the account-storage change.

## Merged workload measurement

[Raw measured results](usage-results-merged.json), 2026-10-08, isolated
`earnest-cobra-841` only; synthetic 5,000-Food and 10,000-Set fixtures were never
imported into regular dev. The fixtures now use explicitly verified performance
and sourced reference fields from the merged model.

- Entire scripted workload: 40 completions, 178,806 database-read bytes,
  7,945 database-write bytes, 1,113,145 client response bytes; within the agreed
  45-call / 256 KiB-read / 16 KiB-write / 1.2 MiB-client budgets.
- Latest Set: one document, 509 database-read bytes at both 1,000 and 10,000
  historical rows; 433 / 435 client bytes respectively.
- Best-reference repair after edit: 1,269 / 1,959 read bytes (3 / 5 documents)
  and 2,049 write bytes at 1,000 / 10,000 rows. These measurements do not imply a
  constant document count for arbitrary tied candidates or excluded sessions.
- Food edit with ten receipt retries: 22,329 read bytes and 3,847 write bytes.
- Indexed search separately measured 831,074 text-index-query bytes; these are
  not hidden inside the database-read figure. The edit reported 81 text-index
  write-query bytes.

These are workload samples, not a new plan/quota audit or a whole-app monthly
usage guarantee. See the dated quota context in the original report.

## User handoff and next release

Test normal dev before proceeding: personal Food/Combo save and reopen, note
save, food logging, a Strength Session, and failed-save input/retry behavior.
After user acceptance, verify live EAS environment and runtime compatibility,
complete both production migration gates, deploy the production backend, and
publish a compatible preview update with source maps (or build a new binary if
required). Preview currently points to the production backend.
