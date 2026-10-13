---
type: record
kind: verification
description: Read for the mobile query subscription cache pilot and its measurements.
version: 1.0.0
status: closed
date: 2026-10-08
---

# Mobile query subscription cache

## Current status

2026-10-08, branch `t3code/offline-behavior-decision`, changes based on `fa297f2`.
Fetched origin/main and compared local main before implementation: local main
and this branch were identical; remote main was behind that integration.
The pilot is implemented locally. Production and preview distribution are
separate from this verification.

## Scope and lifecycle

`apps/mobile/src/convex/query-cache.tsx` selects `convex-helpers` 0.1.120, compatible
with Convex 1.42.1. Newer helper releases require a newer Convex peer; no framework
upgrade or supply-chain policy exception was introduced.

Pilot callers: `useTrainingData`, `useStrengthSession`, and the queries in
`nutrition-day.ts`. Query function and arguments determine reuse. Foreground
queries on focused screens retain their subscription for 30 seconds after their
last consumer leaves, with at most 20 idle subscriptions. This cap does not limit
actively consumed queries. Hidden screens stop consuming queries even when the
navigation stack leaves them mounted.

The authenticated Clerk session scopes the cache. Sign-out/account replacement
disposes it. Account maintenance also unmounts the cache before test-data reset
or local cleanup, so prior results cannot leak into the reopened screens. Background/inactive transitions release both active and idle pilot
subscriptions; returning foreground starts needed subscriptions again. Changing
cache options preserves children/editor state. Ordinary Convex queries elsewhere
are not controlled by this pilot.

The dependency patch adds provider disposal on replacement/unmount and uses native
global timers. It patches the shipped JS and TS source; pnpm records its hash.
Without it the upstream provider leaves old subscriptions alive until expiry.
Recheck disposal and patch applicability before upgrading the helper.

SQLite Nutrition snapshots remain for restart/offline reads, Set Drafts and device
defaults remain local, and legacy migration records remain protected. Existing
Training retention remains useful when a refresh fails or a subscription expires;
it is not interchangeable with keeping a subscription alive. No durable offline
write queue was added.

## Automated and bundle evidence

- Mobile Jest: 94 suites, 614 tests passed, including five real helper/provider
  lifecycle tests through public query hooks and a controllable Watch transport.
- Focused Training/Set/cache verification: 3 suites, 24 tests passed.
- Root Vitest: 61 suites, 445 tests passed.
- Root and mobile typechecks, Biome, mobile architecture, web build, and iOS Hermes
  bundle export passed.
- Online Expo dependency validation flags newer patch releases for 11 existing
  SDK packages. Their versions are unchanged from main; this remains a separate
  dependency-maintenance check. The existing `@expo/require-utils` TypeScript peer
  warning also remains. The helper introduces no unmet Convex peer.

## Read-only live navigation measurement

Run from the repository root:

```sh
node apps/mobile/scripts/measure-query-cache.mjs /tmp/query-cache-measurement.json
```

The script refuses anything except a matching scoped, isolated cloud development
worktree. It uses an ephemeral empty-account identity and performs no mutations.
It mounts/unmounts the real Convex/helper hooks ten times for the same four queries:
Routines, active Strength Session, today's diary and effective-dated goals.

Observed on isolated deployment `earnest-cobra-841`:

| Metric | Ordinary hooks | Retained subscriptions |
| --- | ---: | ---: |
| Visits | 10 | 10 |
| Wire query additions | 40 | 4 |
| Wire query removals, including cleanup | 40 | 4 |
| WebSocket response bytes | 26,116 | 2,578 |

These are wire measurements, not billed function executions or database I/O.
There were no concurrent data edits in this workload. Retention can receive
otherwise-unused updates; these measurements do not prove equivalent savings
under frequent writes or on larger responses. The helper stays opt-in for search
terms and growing history; no blanket app-wide cost reduction is claimed.

## Native acceptance

Verified on a fresh iPhone 18 Pro simulator
`Workouts Query Cache 3be9d410`, iOS 27.0, bundle `com.appelent.foundry`, this
checkout's Metro on port 8190, isolated backend `earnest-cobra-841`.

- Signed in and loaded Training; the empty Routines result resolved correctly.
- Opened today's empty diary, selected October 7, and read the existing Combo
  and account-saved notes. Quick Training/Nutrition tab returns remained readable.
  [Diary screenshot](diary.png).
- Entered `Cache QA draft` in the New Routine editor, sent the app to Home, and
  reopened it. The same editor and unsaved name remained. Cancelled without
  creating a Routine. [Resumed editor screenshot](editor-resume.png).
- Read the existing completed workout summary, including the saved 65 kg × 5
  Squat. [Workout summary screenshot](workout-summary.png).

These native observations establish rendering, navigation and editor continuity;
they do not instrument subscription counts. The automated lifecycle checks cover
expiry, the idle cap, account replacement, and active/idle background cleanup.
The live script supplies wire counts. This pass did not create a new active
Strength Session or perform native sign-out/account switching; its Set/save
behaviour remains covered by the existing mobile tests.
