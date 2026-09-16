---
status: accepted
---

# Keep nutrition local-first without allowing history to drift

Nutrition remains usable without a connection: diary changes are accepted locally and later acknowledged by the shared account history, while Personal Foods and Combos are authored locally with explicit opt-in account backup. Legacy libraries require an explicit claim, conflicts require a person's choice, deletions remain meaningful, and Capture Drafts stay device-only until their own synchronization needs are justified.

Historical nutrition never follows mutable source data. Diary Entries are snapshots, future Combo logs resolve the current figures of referenced Foods before creating new snapshots, and each historical date retains the Nutrition Goals effective then.

We chose this boundary over requiring the server for ordinary logging or treating every local record as automatically shared. It preserves offline use and user control without making durable diary history device-bound, at the cost of explicit reconciliation rules and clear disclosure for records that remain device-only.
