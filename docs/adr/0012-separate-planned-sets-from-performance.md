---
status: accepted
---

# Keep planned sets separate from logged performance

Starting a Routine creates Planned Sets, not recorded performance. Only explicit
logging creates a Set: a routine prescribing three sets of eight starts with
three targets and zero performed sets. This replaces the current shortcut of
inserting the prescription as logged sets, which cannot distinguish intended
work from work actually performed and can contaminate history and records.

Set Drafts and Planned Sets must stay outside performed-set totals and
performance-derived references. The data boundary applies to every client using
the shared backend. Existing history remains as recorded; apply the new split to
new sessions. Legacy timestamps cannot reliably establish which targets were
performed, so migration must not guess or turn unverified legacy references into
measured performances. Compatibility details remain in the
[implementation contract](../product/app-redesign.md).
