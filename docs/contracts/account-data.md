---
type: contract
description: Read when changing data ownership, saving, caching, Convex usage, or device-local account state.
version: 3.0.0
status: current
---

# Account data

Saved personal data should belong to the account and work on a fresh installation
without depending on existing device storage. Optional Personal Library backup
and device-only saved Capture Drafts make that ownership inconsistent. Convex
usage should remain efficient as libraries and history grow. Decision:
[ADR 0014](../adr/0014-online-first-account-data.md); background:
[online/offline research](../records/2026-10-07-online-offline-research.md).

## Behavior

- Convex owns acknowledged personal data: Personal Foods, Combos, reusable
  training definitions, personal history, Nutrition Goals, Body Metrics, and
  saved Capture Drafts. Account storage is automatic, not optional backup.
- Own Food and One-off Entry photos use account-owned Convex storage. Save waits
  for upload and server acknowledgement; records store the file identifier and
  resolve its URL on read. Open Food Facts images retain their provider URL and
  use a disposable image cache. An explicit crop/replacement becomes an own photo.
  Existing ambiguous OFF copies adopt the provider image, as selected by the sole
  user on 2026-10-13. Image unavailability does not block using nutrition data.
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

Mobile uses the `retention` flavor of the Convex query caching standard. Every
`useQuery`/`useQueries` read goes through `apps/mobile/src/convex/query-cache.tsx`,
which retains a left subscription for 5 minutes (at most 20 idle). The account
owns the cache; backgrounding releases idle subscriptions without remounting
editors. Paginated queries are not retained. There is no on-device copy of query
results. Nutrition account snapshots use session memory; only optional defaults and
bounded OFF request/image caches persist. Set Drafts keep their separate purpose.
Adding a disk cache means adopting the `last-known` flavor, which is a separate
decision. Measurements for the earlier 30-second pilot are in the
[pilot verification](../records/2026-10-08-query-subscription-cache/README.md).

Before declaring usage acceptable, inspect actual Convex allowances and current
consumption. Record database I/O, function calls, and client bytes separately,
with record sizes and active-device assumptions. Use a representative
5,000-Personal-Food library, 20 unchanged navigation/picker visits, search, a Food
edit, repeated saves, reconnection, and restart. Include growing training history.
Explain repeated transfers and subscription reruns, fix demonstrated waste, and
record a numerical usage budget from actual evidence. No savings or budget is
assumed by this design conversation.

## Account isolation

Writes are authenticated, retry-safe, and isolated by account. Account switching
isolates local defaults, cached data, in-flight requests, and late responses.
Current builds read and write personal data only through Convex; they do not
read, upload, or claim device-local data from before account storage.

## Local state reset

A confirmed test-data Load/Clear discards the account's personal local state,
including its Set Drafts, deletes its uploaded photo files, and resets
subscription retention before reopening providers. Optional preferences,
remembered portions, and OFF caches remain.

## Out of scope

Durable active Strength Session recovery is a separate possible investigation.
If revisited, the desired mobile scope is continuing a session started online,
adding/editing/removing Sets using available Exercises, and finishing offline,
with recovery after process termination and later upload. The agreed conditional
exit policy is synchronization or explicit discard before voluntary sign-out;
unexpected auth expiry retains work for the same account. Not part of
this contract.

Also out of scope: generic offline synchronization, browser offline launch,
mandatory 90-day history downloads, guaranteed background uploads, cross-device
sync of convenience defaults, backup/disaster recovery, and custom incremental
sync without measured justification.

## Acceptance

- Fresh installation and cleared caches: all existing online features work and
  acknowledged records reload after signing in.
- Nutrition logging and Capture Draft Save: no false success when disconnected,
  retryable input while the editor remains open, and no write per keystroke.
- Public Convex API checks: authorization, validation, account isolation,
  overlapping edit ordering, retry behavior, and updates after deletion.
- Account switching: no defaults, cached data, or late responses from the
  previous account.
- Regression checks: historical snapshots/goals and shared-event ownership.
- Actual mobile connectivity and lifecycle checks, plus affected web flows.
  Report that unsent work is not guaranteed to survive process termination.
- Real Convex usage evidence for the scenarios above. Mocked query values and
  request counts alone do not prove storage or database-cost behavior.

The one-time migration of device-local data into the account completed (the
sole user ran it on build 20). Its client and server code, the legacy guards,
and persistent account read copies are removed. See
[ADR 0015](../adr/0015-account-food-photos-and-cache-retirement.md).
Evidence: [implementation and usage](../records/2026-10-08-online-first-account-data/README.md).
