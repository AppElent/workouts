# Local merge selection — 2026-09-22

The user selected all changes except items 4 and 5 from the change inventory.

- Removed item 4: Personal Food once again shows its icon/photo editor before
  the name fields, with those controls always visible. Its appearance support
  remains.
- Removed item 5: estimate review uses the existing in-place editor, and food
  matches use the earlier button list. The shared form layout and appearance
  support remain.
- Retained System / Light / Dark, shared Nutrition form improvements, native
  adaptive selection controls, keyboard/layout fixes, contrast and feedback,
  navigation fixes, Android goal dragging, accurate loading/offline states,
  One-off Entry validation, localized wording, SQLite connection isolation,
  tests and review artifacts.

Integration preserves local main's newer Food library, batch diary selection,
native charts, native empty states, grouped lists, typography and Expo package
alignment. Appearance also applies to the newer screens and native hosts.
Batch entries retain their source Meal Slots, and tests use the current menu
and batch APIs.

The September 20 screenshots and recordings in this directory are historical
review evidence. Food editor, estimate review, match selection and navigation
images may show the earlier prototype. They do not certify the September 22
integration or native iOS acceptance. The physical iPhone checklist remains in
[REVIEW.md](REVIEW.md).

The integration is for a local merge only; no push or deployment is requested.

Validation of the combined committed scope: mobile TypeScript, 60 mobile suites
/ 408 tests, mobile Biome (250 files), root Biome (411 files), root TypeScript,
38 root suites / 334 tests, production web build and iOS JS/Hermes export all
passed. Dependencies were installed from main's existing frozen lockfile.
