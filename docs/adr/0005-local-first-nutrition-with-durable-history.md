---
status: accepted
---

# Keep nutrition local-first without allowing history to drift

Nutrition remains usable without a connection: diary changes are accepted locally and later acknowledged by the shared account history, while Personal Foods and Combos are authored locally with explicit opt-in account backup. Legacy libraries require an explicit claim, conflicts require a person's choice, deletions remain meaningful, and Capture Drafts stay device-only until their own synchronization needs are justified.

Personal Measures are account-synced and cached for offline logging, but creating, changing, reordering, and deleting them requires a connection for now. An offline device may log with its cached value; that displayed value is snapshotted and is not reinterpreted if another device has since changed or deleted the Personal Measure.

Historical nutrition never follows mutable source data. Diary Entries are snapshots, future Combo logs resolve the current figures of referenced Foods before creating new snapshots, and each historical date retains the Nutrition Goals effective then.

We chose this boundary over requiring the server for ordinary logging or treating every local record as automatically shared. It preserves offline use and user control without making durable diary history device-bound, at the cost of explicit reconciliation rules and clear disclosure for records that remain device-only.
