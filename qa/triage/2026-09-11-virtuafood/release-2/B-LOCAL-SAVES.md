# B — Durable local diary saves

## Goal

All nutrition writes use one locally committed outbox and one projection. A food added offline remains visible after repository reopen and eventually reaches the server once, including when the first server response was lost.

## Implementation sequence

1. Use the existing expo-sqlite version and repository-injection style. Create a separate nutrition-state database with one migration owner. Tables cover account-scoped operations, cached days with revision/completeness, and entry identity mappings. Task C may extend this same migration owner for shortcuts. Store no credentials. Migration is transactional and preserves existing rows.
2. Build a pure deterministic projection: accepted complete server day plus unacknowledged local operations in durable sequence order. Recompute totals from projected entries with existing helpers. Overlay moves onto both dates. A local new ID must be representable distinctly from a server ID throughout editor/delete/receipts.
3. Implement submit and replay service, then integrate provider/auth/connectivity lifecycle.
4. Route browser single-food saves, entry updates/deletion and existing Combo saves through it. Retain current validation, confirmations and input guards.
5. Connect diary reads to persisted cache and overlays, then add precise status UI.

## Persistence and processing rules

Local acceptance transaction stores the immutable operation and its projection inputs. A double-tap ref lock covers that transaction. Do not enqueue in memory and persist later. If the transaction fails, keep the sheet and values intact, clear pending state, surface an error. After commit, return a typed local receipt immediately; replay proceeds independently.

States: queued → sending → acknowledged; transient network failure returns to queued with bounded backoff; permanent validation/conflict failure becomes needs-attention. Persist attempts/error classification. A sending operation found at restart becomes queued with the SAME IDs and payload. Process in sequence per subject, one worker at a time. Connectivity and foreground transitions trigger work without hot loops. No claim of guaranteed background execution after OS termination: replay resumes when the authenticated app runs.

Edits/deletes made while a create is pending are separate immutable operations referencing its client entry ID, ordered after creation. Do not rewrite an operation possibly accepted by the server. Dependent operations wait for successful predecessors; a failed predecessor blocks its dependents, not unrelated independent entries. Retry reuses the exact operation. A corrected permanent failure uses a new operation only when it is known not to have applied; retain the original audit state and rebase dependent intent explicitly. If unsure, offer retry/status rather than guessing and losing data.

On acknowledgement, transactionally accept returned day snapshots only when their revision is at least the cached revision, save ID mappings and mark the operation acknowledged. Removing the acknowledged overlay and installing the server snapshot happen atomically. Ignore stale subscription snapshots by revision. Persist each new complete subscription snapshot and then project outstanding local operations. Never count a client entry twice when a subscription arrives before its acknowledgement; reconcile by client entry ID and operation effects/revisions. Specifically test update/delete overlays in this order too, not just create deduplication.

Bind network requests and database work to the subject captured at start. On sign-out, stop scheduling, clear rendered account state, and leave durable data dormant for that account. A late response can update only its originating account's cache; never activate it in another account's view. Use existing signed-in navigation rules; do not block the entire app on an online Convex handshake. Reuse existing network status sources. Cache current goal results if needed to render previously visited days offline; label stale data and preserve static-goal semantics.

## UI contract

Pending row: subtle device/pending marker with accessible “Saved on this device, waiting to sync.” One compact diary status can summarize multiple pending entries; no repeated success toasts. Needs-attention state includes an actionable retry and readable reason. Preserve affected entries/input and avoid silently reporting success or deleting the only copy. Keep destructive discard behind shared confirmation if implemented.

An uncached offline day is “No cached entries available offline,” NOT a confirmed empty day or zero total. Locally added rows can be shown, but totals must be explicitly partial until the complete day is known. A cached day displays its entries and pending overlays with a subdued offline indicator. Loading uses the existing skeleton. Do not replace Add & continue with a network wait; update its local receipt language.

## Required tests / completion

- Close and reopen the actual test SQLite database after save; entry and payload survive. An in-memory mock alone is insufficient. If runtime prevents a real reopen test, mark this gate blocked, not passed.
- Crash windows: before local commit (not saved), after commit before send, after server applies before ACK, after ACK before subscription. One final server entry and correct total in every accepted case.
- Subscription before ACK and older subscription after ACK do not duplicate or revert rows/totals.
- Create→edit→move→delete offline, reopen, replay; correct source and destination days.
- Batch partial network response/retry is atomic; no partial local acceptance.
- A→sign-out→B with late A response: B sees/uploads none of A's operations. Return A resumes.
- SQLite failure retains form; transient errors back off; permanent errors remain visible and do not spin.
- Existing online browser/editor/delete/Combo flows still work, with all nutrient states preserved.

Done when every nutrition write caller uses the service and automated durability/reconciliation tests pass or are explicitly blocked with evidence. List physical-device force-quit verification separately.
