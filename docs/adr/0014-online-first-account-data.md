---
status: accepted
---

# Keep personal data account-owned and online-first

Use Convex as the authoritative store for saved personal training and nutrition
data. A fresh installation with a connection must work without pre-existing local
data. Local read caches and remembered input defaults are disposable conveniences.
Nutrition logging requires a connection; failed logging preserves input while the
editor remains open, without promising recovery after app termination.

Require server acknowledgement before reporting an account write as saved.
Temporary connection recovery in the running client does not promise durable
recovery after app termination. Defer durable active Strength Session recovery
to a separate investigation: even the narrowed mobile promise needs custom
persistence and retry handling, offline startup/authentication changes, and local
completion/summary behavior. That complexity has not earned inclusion in issue
89. General offline editing and offline browser operation are also out of scope.

Allow simultaneous editing without device locks or conflict dialogs. The last
server-accepted edit takes precedence for overlapping submitted values. Distinct
records remain distinct and retries must not duplicate writes. Synchronized
account data remains recoverable online; unsent input is not account data yet.

This direction replaces the broad offline scope in
[issue 89](https://github.com/AppElent/workouts/issues/89) with a smaller promise.
It also changes the local ownership, optional backup, and manual conflict choices
in [ADR 0005](0005-local-first-nutrition-with-durable-history.md), while retaining
its frozen historical nutrition and effective-dated goals. Adoption requires
migrating existing local-only nutrition records and resolving pending writes
without silent loss. This decision supersedes ADR 0005's ownership, optional
backup, offline-write, and manual conflict policies; implementation must be
tracked separately from acceptance.

Optimize Convex usage through bounded reads and measured subscription lifetimes.
Choose additional cache libraries only for demonstrated benefits. TanStack Query
is not selected as an offline engine or assumed to reduce costs. See the
[research and interview record](../research/issue-89-online-offline.md).

Accepted on 2026-10-07. See the
[implementation contract](../product/online-first-account-data.md). The research
record retains the desired behavior and conditional sign-out policy for the
deferred recovery investigation; they are not requirements of issue 89.

Implementation evidence: [account data verification and usage](../verification/online-first-account-data/README.md).
The original device-only Food photo exception is superseded by
[ADR 0015](0015-account-food-photos-and-cache-retirement.md). Production adoption follows the
[migration runbook](../runbooks/nutrition-account-migration.md).
