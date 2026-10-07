---
status: accepted
---

# Add personal Servings without forking Shipped Foods

User-added Servings for Shipped Foods are separate account-owned records linked
by permanent Shipped Food ID; Servings for Personal Foods remain embedded in
the Personal Food. Adding a named amount does not correct nutrition figures,
so it must not create a Fork, shadow the original, or detach the food from future
shipped updates.

These additional Servings follow the Personal Measure synchronization boundary:
account-synced and cached for offline logging, with a connection required for
creation, changes, and deletion. Confirming creation saves the Serving
independently of the enclosing Diary Entry edit. Historical Diary Entries retain
their snapshots when a Serving changes or is deleted.

If a person later creates a Fork to correct nutrition, copy their additional
Servings into the new Personal Food once. The original additions and the Fork's
embedded Servings then evolve independently.

This extends [the local-first boundary](0005-local-first-nutrition-with-durable-history.md)
and clarifies [the read-only shipped catalogue](0006-ship-nevo-as-generated-core-data.md):
personal supplementary Servings leave the catalogue unchanged. It introduces a
separate storage and composition contract instead of copying an entire food
merely to customize its offered amounts.
