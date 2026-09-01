# Activity types are a closed set in code, not an open catalog

`exercises` is a hybrid catalog today: `isDefault` built-ins plus user-created rows in one table. We decided **not** to extend that pattern to Activity types (strength, running, cycling, WOD, ...) — activity types remain a closed set of literals defined in code, not a data-driven, user-extensible catalog.

Per [ADR-0001](./0001-activity-envelope-detail-split.md), every activity type needs its own detail-table schema and its own logging UI — a database row can supply a dynamic label/icon but not dynamic logging behavior, so an open catalog would only simulate extensibility while still requiring a code change for every real new type. Revisit this if a future requirement genuinely needs user-defined types with generic (not per-type) detail capture.
