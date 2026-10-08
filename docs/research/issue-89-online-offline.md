# Issue 89: online/offline decision evidence

Status: completed design interview and supporting research, 2026-10-07.
[ADR 0014](../adr/0014-online-first-account-data.md) and the
[revised issue 89 contract](../product/online-first-account-data.md) are accepted.
Runtime migration remains pending. Source inspection: `c59d8fb`.

Related: [issue 89](https://github.com/AppElent/workouts/issues/89),
[earlier nutrition boundary, partially superseded](../adr/0005-local-first-nutrition-with-durable-history.md).

## Decision being revisited

The user prefers online-first behavior unless good offline support can be achieved
with low implementation and maintenance complexity. Efficient Convex usage is a
requirement in either case. Issue 89 currently describes a considerably broader
project: persistent offline edits across personal training and nutrition on both
clients, history downloads, replay, conflicts, deletion handling, authentication
recovery, account isolation, and migration.

Automatic account storage, offline operation, and subscription efficiency are
separate decisions. Choosing one does not establish the others.

## Existing behavior

- Mobile nutrition already persists operations in SQLite and replays them. See
  [repository](../../apps/mobile/src/data/nutrition-local-repository.ts),
  [operation service](../../apps/mobile/src/data/nutrition-operation-service.tsx),
  and [server receipts](../../convex/nutritionDiary.ts).
- Personal Foods and Combos use local ownership, optional account backup, and
  explicit conflict resolution. See
  [provider](../../apps/mobile/src/data/personal-foods.tsx) and
  [library service](../../apps/mobile/src/data/nutrition-library-service.ts).
- Capture Drafts are currently device-only. Training reads use ordinary Convex
  hooks in [session data](../../apps/mobile/src/data/session-data.ts).
  [Running/cycling v1](../product/running-cycling-v1.md) explicitly excludes offline
  synchronization.
- The root manifest includes the Convex TanStack adapter, but inspected web and
  mobile source does not wire up a TanStack Query client. Persistence would be a
  new integration, not an existing feature switch.

Extending today's nutrition implementation to all domains is substantial work.
Removing it also requires migration and a deliberate change to existing behavior.
Neither direction should be treated as free.

## What the libraries provide

Convex queues client mutations **in memory** and maintains live query
subscriptions. This supports connection recovery but does not establish durable
recovery of unsent writes after process termination.
[Official client overview](https://docs.convex.dev/understanding/overview).

TanStack Query supports persisting query/mutation state and resuming paused
mutations. Resumption after reload requires registered default mutation functions,
because executable functions cannot be serialized. These primitives do not define
this app's account isolation, conflict policy, dependent record identities, or
server-side duplicate prevention.
[Official mutation guide](https://tanstack.com/query/latest/docs/framework/react/guides/mutations).

An integration risk needs explicit verification: TanStack's default dehydration
selects paused mutations. A Convex request already pending when connectivity is
lost is not necessarily a paused TanStack mutation. Merely adding a persister
does not prove that this in-flight write survives termination. This is an
inference from the two client models, not a tested failure in this app.
[TanStack dehydration source](https://github.com/TanStack/query/blob/main/packages/query-core/src/hydration.ts).

The Convex TanStack adapter is documented as beta. Its subscriptions remain active
after their last component unmounts until `gcTime` expires, five minutes by
default; Convex recommends reducing this when it causes unwanted function
activity. Adding TanStack Query therefore does not inherently reduce backend
usage.
[Official adapter guide](https://docs.convex.dev/client/tanstack/tanstack-query/).

Follow-up caching recommendation: retain ordinary Convex hooks unless a measured
problem justifies another layer. The `convex-helpers` query cache also retains
live subscriptions after their consumers leave; it can smooth navigation but
does not inherently reduce work. Neither library should be adopted solely on an
unmeasured assumption of lower cost.
[Maintainer cache explanation](https://stack.convex.dev/magic-caching).

Remembered nutrition portions already exist as account-keyed local shortcuts in
[the local repository](../../apps/mobile/src/data/nutrition-local-repository.ts).
[Shortcut resolution](../../apps/mobile/src/data/nutrition-shortcuts.ts) validates
the remembered amount and available serving. This is a disposable input default;
saved Diary Entries remain independent snapshots. If writes become online-only,
define "last used" by successful save, or explicitly call earlier updates "last
selected." No durable diary queue is required just to remember an input default.

## Convex usage is an independent workstream

Source inspection identifies concrete measurement targets without assuming a
client cache is the solution:

- `getLastForExercise` and one-rep-max recalculation in
  [sets](../../convex/sets.ts) load full exercise history through
  [the catalog helper](../../convex/lib/exerciseCatalog.ts). Measure growth with
  training history and consider bounded latest-record reads where semantics allow.
- Normal nutrition diary reads use an account/date index, while operation replay
  also reads and stores affected-day snapshots in receipts. Durable offline
  support has backend costs of its own.
- [Recent and active sessions](../../convex/workoutSessions.ts) already use
  bounded/indexed access. Preserve these patterns.

Measure function calls, database read/write traffic, and client payloads
separately. Convex's server query cache can avoid database reads on cache hits;
this is distinct from device persistence.
[Realtime and caching](https://docs.convex.dev/realtime),
[usage definitions](https://docs.convex.dev/production/state/limits),
[index performance](https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf).

## Interview decisions and open frontier

Round 1 user answers:

1. Preserve and resume an active Strength Session after loss of connectivity and
   process termination, then synchronize it.
2. Save data online. Optional offline preferences may exist, but the app should
   work without local data.

Working interpretation of answer 2: a fresh installation with a connection can
recover account data and operate normally. Local cached history is an
optimization, not the only copy of saved history. Active-session recovery still
requires an automatic durable safety copy of changes awaiting server acceptance;
that copy cannot be optional while promising answer 1. Deleting local storage
before those changes synchronize cannot recover them from the server. This
distinction has been surfaced to the user; detailed save-state language remains
open.

Round 2 user answers:

- Nutrition data can live online; the concern is Convex usage, addressed through
  efficient queries, caching, and possibly remembered portions. This confirms
  account ownership but does not yet specify disconnected-write behavior.
- Mobile first for active-session recovery.
- The user questions whether simultaneous recording needs explicit management.
  The earlier recommendation to introduce a single recording device has not been
  accepted. Prefer avoiding device locks unless a user need justifies them.

Follow-up user decisions:

- Nutrition logging requires a connection. Preserve input for retry instead of
  accepting a durable offline Diary Entry. This is independent of cached reads
  and remembered portions.
- Unsaved nutrition input only needs to survive while its editor remains open;
  no restart recovery is required for that form.
- An active Strength Session may add/edit/remove Sets, use Exercises already
  available on the device, and finish offline. Changes survive restart and
  upload later. Starting a new session requires a connection.
- No device coordination or conflict dialogs. The last server-accepted edit
  takes precedence for overlapping submitted values, even when sent from an
  older offline session. Distinct Sets remain distinct; retries must not
  duplicate Sets.
- If durable workout recovery proceeds, voluntary sign-out requires
  synchronization or explicit discard of pending session changes. Unexpected
  authentication expiry preserves those changes for reauthentication by the
  same account. This answer settles the conditional exit policy; it does not
  answer whether recovery should remain in issue 89.

Final scope answer:

- The user accepted deferring durable active-session recovery. Issue 89 now
  targets online account storage, efficient Convex usage, and lightweight caches.
  Earlier recovery answers describe the desired behavior for a separate future
  investigation, not a delivery requirement of this issue. No prototype is
  required to complete the revised issue.

The user confirmed the assembled scope and authorized updating issue 89. The
design frontier is closed. The accepted
[implementation contract](../product/online-first-account-data.md) and
[ADR](../adr/0014-online-first-account-data.md) record the resulting direction.
No application changes have been made.

Current Set updates already patch supplied fields without a revision check.
However, the mobile set editor submits weight, reps, and set type together: an
edit can overwrite a concurrent change to another submitted field. "Last
server-accepted edit wins" must not be described as automatically merging the
person's intent. The user accepted this simple outcome without locks or conflict
dialogs. Offline replay still must not silently resurrect deleted records.

Cached reads and remembered input defaults are independent of accepting offline
writes. Their absence should not prevent online operation or change saved
historical nutrition. Choosing connection-required nutrition writes requires a
planned migration of existing local-only records and pending operations.

The accepted online-first contract treats server acknowledgement as saved;
offline/session recovery edge cases are deferred with that feature. Related
contracts identify the superseded policies. Keep domain vocabulary in
`CONTEXT.md`; general cache/synchronization terms do not need a second glossary.

## Active-session feasibility findings

Source inspection after the user narrowed the promise found these necessary
changes; no implementation or runtime proof has been performed:

- Training screens currently await ordinary server mutations. They need a
  durable session snapshot, local display of pending changes, and replay.
  Nutrition's queue offers patterns but is coupled to nutrition operations.
- Sets receive server-generated IDs. Offline adds followed by edits/deletes need
  stable local identities and retry receipts, including the case where the
  server commits an add but the device dies before receiving its acknowledgement.
- `apps/mobile/src/auth/convex-session-gate.tsx` gates app children on Convex
  authentication. The root layout also waits for Clerk resolution. Durable data
  alone does not make a cold offline launch usable; an account-isolated recovery
  route must be accessible before network readiness, with uploads gated on auth.
- `convex/workoutSessions.ts` records completion using server time. Replay must
  preserve the actual completion time. `apps/mobile/src/screens/summary.tsx`
  currently reads server data; it needs a local pending summary, and completed
  pending sessions must remain recoverable until acknowledged.
- Existing duplicate/cancel/shared-workout controls need an explicit boundary.
  Shared publication stays online. Previously captured Personal Exercises and
  bundled Shipped Exercises can support recovery; an unavailable remote
  definition cannot be assumed cached.

These are bounded responsibilities but real custom work, not a cache setting.
They do not prove that the feature is too expensive, but they invalidate any
assurance that narrowing the promise alone makes it easy.

## Evidence limits

This research records the pre-implementation investigation. It is not a device
test, persistence prototype, or production usage measurement. Subsequent branch
implementation, simulator checks and isolated real-deployment usage measurements
are recorded in [the verification report](../verification/online-first-account-data/README.md).
