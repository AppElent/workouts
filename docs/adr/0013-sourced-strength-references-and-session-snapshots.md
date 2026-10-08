---
status: accepted
---

# Keep sourced strength references and freeze their use within sessions

Logged Sets are the source of performance history. Maintain separate current
Measured and Estimated One-rep Max references per account and Exercise in Convex:
the all-time heaviest eligible logged single and highest eligible multi-rep Epley
estimate. Each derived reference retains its source Set, performance date, value,
unit, and formula where applicable. Manual One-rep Max entries remain independent
and are not automatically overwritten. Extend the existing 1RM owner rather than
introducing a competing calculation or record system.

Store the resolved references and their provenance as snapshots for each
session/exercise. Starting or reopening an editor uses those fixed values;
calculations and candidate application do not write new 1RM records. New logged
performance and source corrections/deletions update the current references for
later sessions without rewriting the values already used by an existing session.

This replaces the combined automatic-best record, which can lose one reference
when the other improves, and avoids live references changing a person's targets
mid-session. A source link alone would lose its meaning when the source is edited
or removed, so snapshots retain the reference value as well as its provenance.
Derived current references remain rebuildable from eligible recorded performance;
session snapshots preserve the context that was actually shown.

Source eligibility and legacy provenance follow the
[planned/performed boundary](0012-separate-planned-sets-from-performance.md) and
the [implementation contract](../product/app-redesign.md#strength-references).
