# Account-owned data with online-first saves and efficient Convex usage

Status: accepted implementation contract for
[issue 89](https://github.com/AppElent/workouts/issues/89), 2026-10-07.
Implemented on the issue 89 branch, with [verification and measured usage](../verification/online-first-account-data/README.md).
Production rollout requires the [migration runbook](../runbooks/nutrition-account-migration.md).
This replaces the earlier durable-offline scope. See
[ADR 0014](../adr/0014-online-first-account-data.md) and the
[research/interview record](../research/issue-89-online-offline.md).

## Problem

Saved personal data should belong to the account and work on a fresh installation
without depending on existing device storage. Optional Personal Library backup
and device-only saved Capture Drafts make that ownership inconsistent. Convex
usage should remain efficient as libraries and history grow. The previous issue
combined these needs with a broad durable offline synchronization system whose
complexity is no longer justified for this scope.

## Agreed direction

- Convex owns acknowledged personal data: Personal Foods, Combos, reusable
  training definitions, personal history, Nutrition Goals, Body Metrics, and
  saved Capture Drafts. Account storage is automatic, not optional backup.
- Food photos remain a device-only visual convenience. Portable Food records
  preserve preset icons; another device uses the default visual when a photo is
  unavailable. Photos are not required to read or use account data.
- The app works after online sign-in on a fresh installation. Device-local
  recents, remembered portions, last-used choices, and view settings are optional
  conveniences. Missing or cleared caches must not prevent online operation.
- Saving requires a connection and server acknowledgement. Clearly distinguish
  pending, failed, and saved writes. Convex's in-memory connection recovery does
  not establish a promise of restart-safe unsent changes.
- Nutrition logging preserves unsaved input for retry while the editor remains
  open. No recovery after dismissing the editor or terminating the app is
  required. Typing causes no remote writes; saving a Capture Draft is explicit
  and online.
- No device locks or manual conflict dialogs. The last server-accepted edit wins
  for overlapping submitted values; device clocks do not establish precedence.
  Independent records remain independent. Retries must not duplicate records,
  and updates to deleted records must not silently recreate them.
- Preserve frozen Diary Entry snapshots, effective-dated Nutrition Goals,
  bundled read-only Shipped Foods and Exercises, and separate Hosted Workout
  ownership. Shared actions, external searches, and AI require a connection.
- Prioritize mobile flows and preserve existing web behavior through shared
  backend changes. This scope does not require adding missing web features.

## Convex usage and caching

Use bounded indexed reads, pagination where needed, stable query arguments, and
deliberate subscription lifetimes. Avoid fetching all training history to answer
a bounded question. Keep keystrokes and disposable input defaults local.

Measure whether retaining a subscription across navigation is cheaper than
reloading it; retaining live subscriptions can also cause unused updates. Do not
mandate full-library downloads or lifelong subscriptions as the solution before
measurement. TanStack Query is an option only if a demonstrated need justifies
the additional integration, not a required cache or offline engine. Lightweight
remembered portions do not require an offline write queue or new settings UI.

The mobile pilot selects `convex-helpers/react/cache` for short subscription
retention on Routines, Strength Session data, and Nutrition day queries. The
account/session owns the cache; backgrounding releases its subscriptions without
remounting editors. Searches and growing history pages retain their existing
query lifetimes. Persistent Nutrition read caches, Set Drafts, preferences, and
legacy migration journals keep their separate purposes. See the
[pilot verification](../verification/query-subscription-cache/README.md) before
extending retention to additional queries or retiring disk caches.

Before declaring usage acceptable, inspect actual Convex allowances and current
consumption. Record database I/O, function calls, and client bytes separately,
with record sizes and active-device assumptions. Use a representative
5,000-Personal-Food library, 20 unchanged navigation/picker visits, search, a Food
edit, repeated saves, reconnection, and restart. Include growing training history.
Explain repeated transfers and subscription reruns, fix demonstrated waste, and
record a numerical usage budget from actual evidence. No savings or budget is
assumed by this design conversation.

## Migration and account isolation

Inspect and extend existing owners before replacing local nutrition mechanisms.
Migrate known-owner local records automatically; require an explicit account
claim for unowned legacy records. Uploads must be authenticated, retry-safe, and
isolated by account. Retain original records and pending operations until server
acknowledgement; interrupted migration must not lose or duplicate data. Resolve
legacy conflicts without silently discarding either unsynchronized version.

Only retire optional backup, local-only saved content, and the old offline-write
paths after the migration is proven. Migration durability is required even
though new ordinary offline writes are out of scope. Account switching must
isolate local defaults, cached data, in-flight requests, and late responses.

## Acceptance evidence

- Fresh installation and cleared caches: all existing online features work and
  acknowledged records reload after signing in.
- Nutrition logging and Capture Draft Save: no false success when disconnected,
  retryable input while the editor remains open, and no write per keystroke.
- Public Convex API checks: authorization, validation, account isolation,
  overlapping edit ordering, retry behavior, and updates after deletion.
- Migration: known-owner uploads, explicit legacy claims, interrupted uploads,
  pending old operations, conflicting legacy versions, and account switching.
- Regression checks: historical snapshots/goals and shared-event ownership.
- Actual mobile connectivity and lifecycle checks, plus affected web flows.
  Report that unsent work is not guaranteed to survive process termination.
- Real Convex usage evidence for the scenarios above. Mocked query values and
  request counts alone do not prove storage or database-cost behavior.

## Deferred

Durable active Strength Session recovery is a separate possible investigation.
If revisited, the desired mobile scope is continuing a session started online,
adding/editing/removing Sets using available Exercises, and finishing offline,
with recovery after process termination and later upload. The agreed conditional
exit policy is synchronization or explicit discard before voluntary sign-out;
unexpected auth expiry retains work for the same account. These are not
acceptance criteria for issue 89.

Also out of scope: generic offline synchronization, browser offline launch,
mandatory 90-day history downloads, guaranteed background uploads, cross-device
sync of convenience defaults, backup/disaster recovery, and custom incremental
sync without measured justification.

## Documentation transition

ADR 0014 is accepted and supersedes ADR 0005's ownership, optional backup,
offline-write, and manual conflict policies. ADR 0005's historical nutrition
guarantees remain in force. Related briefs identify this revised boundary;
Branch verification does not establish that production migration or rollout has
completed. The operator backfill is a release gate.
