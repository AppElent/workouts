---
type: record
kind: verification
description: Read for in-app test data checks and reset limits.
version: 1.0.0
status: open
date: 2026-10-10
---

# In-app test data — 2026-10-10

Implementation of [issue 99](https://github.com/AppElent/workouts/issues/99),
against base revision `fa297f2552a916f6bcbe807248acda6bdcfed350`.
The [product contract](../contracts/test-data.md) owns intended behavior.

## Automated checks

- `pnpm test`: 62 files, 450 tests passed, including five authenticated
  Convex test-data boundary tests using public domain queries.
- `pnpm --filter @workouts/mobile test --runInBand`: 93 suites, 609 tests passed.
- Root and mobile typechecks, `pnpm check` (including mobile architecture),
  and `pnpm build` passed.
- After the runtime navigation correction, mobile types and the focused Profile
  test passed again, as did `pnpm check`.

Boundary coverage includes Load/Clear, repeat Load, manual records, another
account's preservation, active sessions, hosted ownership and participation,
unauthenticated calls, account mismatch, and production rejection. Controlled
time crosses UTC midnight to verify the caller's local today. Public reads
verify training/nutrition families, historical snapshots, missing/trace/zero
nutrients, goal versions, drafts, and One-rep Max sources.

## Runtime observations

Web: T3 collaborative preview at localhost:5190, English. Mobile: Foundry
development client on iOS simulator `141F1DA6-5EE4-4FEF-B4C6-83F16B0F4485`
(Gather Root Header QA), Dutch, Metro 8100. Both used the disposable development
deployment `steady-pheasant-260`, created with a one-day expiry. The normal
development deployment is `colorless-sturgeon-704`; local environment files
were restored after verification. Production was not modified.

- Web Load displayed one destructive confirmation; cancellation returned to
  Account. Confirmed Load showed recent completed strength sessions and manual
  75 kg 1RM. Clear showed empty sessions and 1RM states without signing out.
- Stopping the web client's actual Convex socket and publishing its disconnected
  state disabled both actions and displayed “Connect to change test data.”
  Restarting the connection restored the controls. This was a client connection
  failure injection, not a host-wide network outage.
- On the normal development account, mobile showed the hosted-workout blocker
  and disabled both actions. No reset was performed on that account there.
- On the disposable deployment, mobile confirmation/cancellation, Load, and
  Clear worked. Loaded library showed two Foods, one estimated Recipe, and one
  Combo; Home showed synthetic Strength and Run history. Web also observed the
  mobile-created history through its normal live queries.
- The initial reset remounted navigation into Labs. Setting the signed-in
  Stack's initial route to the main tabs corrected this; subsequent Clear and
  Load returned to Home with usable navigation and the account still signed in.
- For native cleanup, a synthetic file was attached as the photo URI of an
  actual cached diary entry using the simulator's SQLite database. After in-app
  Clear, the file was absent, cached diary entries were empty, library records
  and operations were empty, and nutrition display preferences remained.
  This exercises filesystem deletion, not photo selection/camera capture.
- A deliberately malformed cached-day payload caused cleanup to fail after
  Load's server acknowledgement. The app stayed on its explicit cleanup-failed
  screen. Repairing the fixture and selecting Retry cleanup recovered to Home
  with the loaded baseline. Completion was not presented while cleanup failed.

These observations were collected through DOM inspection, native accessibility
snapshots, and read-only SQLite/file checks after the actions. No screenshot
archive is retained. Production hiding is covered by server availability tests;
no production runtime reset was attempted. Android, physical devices, the full
theme/Dynamic Type matrix, and native network-loss injection were not exercised.

## Operational limits and review

Reset is one atomic Convex mutation. Accounts exceeding 6,000 personal records
are rejected before commit with an actionable message; use a smaller test
account. This is not a bulk performance-data reset service. Any hosted-workout
involvement conservatively blocks reset to protect shared references.

Separate Standards and Spec reviews found no remaining concrete issues after
fixes to error messages, local-date handling, missing boundary cases, and the
runtime navigation correction. The dedicated synthetic verification identity
on the normal dev deployment was cleared after its smoke check.

## Open

- [ ] Android and physical devices.
- [ ] Full theme and Dynamic Type matrix.
- [ ] Native network-loss injection.
