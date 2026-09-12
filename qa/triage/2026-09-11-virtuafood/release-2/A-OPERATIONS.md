# A — Retry-safe server operations

## Goal and sequence

Make replay safe before adding offline UI. Inspect current schema, auth, snapshot validators, core arithmetic, existing Convex test setup and all callers. Keep existing endpoints compatible for older clients and tests. Read the Convex expert skill before edits.

1. Define and test the operation contract below in a small shared/pure module consistent with package boundaries.
2. Add optional entry metadata and server receipt/day-version tables with indexes.
3. Implement authenticated application of operations in one transaction, including day revisions.
4. Adapt the existing day query and legacy mutations compatibly, then run focused tests.

## Contract

One envelope contains `operationId`, an expected authenticated subject, a versioned payload, and one of create, createBatch, update, remove. Verify expected subject equals server identity; all ownership comes from auth. Accept a client-generated UUID per new entry, distinct from Convex IDs. Existing rows without client IDs remain addressable by owned server ID. Use a discriminated target type, not a fake Convex ID cast.

Create contains a complete existing diary snapshot plus client entry ID. Batch contains 1–100 complete snapshots for a single target date/meal; rejects as a whole if any part is invalid. Update targets an existing entry and replaces quantity and/or date/meal using current snapshot arithmetic. Remove targets an entry. A new target date must be a real YYYY-MM-DD calendar date. Validate finite positive quantities/amounts, nutrient values against domain rules, and meaningful batch/string limits. Preserve all provenance fields and bilingual text.

Use a receipt keyed by authenticated user + operation ID. Transactionally check it first. Same ID plus identical normalized payload returns the original result without writing again; same ID with different payload is rejected. Store a deterministic canonical payload representation (not order-sensitive incidental JSON) or equivalently safe comparison. Return resulting entry IDs/client IDs and affected-day snapshots/revisions. Persist receipt with the mutation atomically. Do not prune receipts in this release: deleting an entry must not allow a delayed create retry to resurrect it.

Enforce client entry ID uniqueness per user as a second guard. Fresh intentional create uses a fresh ID; a collision from a different operation is an explicit conflict. Convex index lookup plus insert must occur in the same mutation transaction. Validate owner for every target. A remove of an already-missing owned target on replay is satisfied by its receipt; an unknown first-time server target must not leak another user's data.

## Reconciliation contract

Maintain a monotonically increasing revision per user/day, starting at zero for preexisting days. Every diary-writing endpoint, including legacy create/logCombo/update/remove, increments revisions of affected dates in the same transaction. Moving an entry increments both dates. Extend day results with revision while preserving existing fields. Successful operation results contain complete affected-day entries/totals with their revisions, including an empty day after deletion.

This permits the local repository to reject older subscription responses after a mutation acknowledgement. A replayed receipt may return an older snapshot; the client must not replace a higher revision with it. Query and mutation must use the same authoritative projection helper. Avoid collecting a user's complete history to read one day; retain indexed user/date queries. No new goal-history semantics.

## Required tests / completion

- Create twice with same ID yields one row and same result; different payload rejects.
- Lost-ACK replay, batch replay, update replay (quantity not multiplied twice), remove replay.
- Receipt survives entry removal; old create cannot resurrect it.
- Two distinct operation IDs create two intended entries; client-ID collision rejects.
- Cross-user entry access and subject mismatch reject without writes.
- Invalid batch part rolls back all entries, receipt, and revisions.
- Moving dates updates both revisions; legacy endpoints participate; empty-day version remains.
- Snapshot copy preserves nutrient states/provenance exactly; quantity edits retain existing arithmetic behavior.

Done when these behaviors run in real Convex test infrastructure, generated types are updated through the supported process where available, and legacy callers/tests remain compatible. Document any blocked codegen; do not hand-edit generated API files or use production deployment as a test.
