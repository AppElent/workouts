---
status: accepted
---

# Correct source nutrition and one explicitly selected Diary Entry

Correcting missing nutrition through a Diary Entry's “Aanvullen” action updates
the source Food and applies only the nutrient fields explicitly changed in that
action to the selected entry, scaled to its logged quantity. Other saved fields
and all other Diary Entries remain unchanged, including entries for the same
Food on the same date. Correcting a Shipped Food follows the existing Fork rule.

Ordinary Food edits still never update historical snapshots. This explicit,
entry-scoped correction extends the [durable history boundary](0005-local-first-nutrition-with-durable-history.md)
so a person can resolve the missing figure they encountered without leaving that
entry incomplete or silently refreshing unrelated historical figures. We chose
this over source-only correction, replacing the entire snapshot, or updating all
entries sharing the source. The correction must remain distinguishable from
figures originally captured from the source.
