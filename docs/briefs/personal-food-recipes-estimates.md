# Personal Food, Recipe, and Nutrition Estimate implementation

## Objective

Implement the domain model agreed in `CONTEXT.md`: Recipe is a classification of Personal Food, Nutrition Estimate is independent of classification and provenance, and estimate status follows immutable Diary Entry snapshots. Replace the separate Recipe model instead of layering an adapter over it.

Work only in the Orca-created child worktree named in the launch prompt. Commit coherent increments as they pass their focused tests; do not leave all changes for one final commit. Do not push or open a pull request.

Read `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, and `docs/adr/0005-local-first-nutrition-with-durable-history.md` before editing. Use the applicable project skills, including the Convex expert instructions for every change under `convex/` and the mobile skill router for Expo/mobile work.

## Required model

- Personal Food is the one reusable-food record. Add a Recipe classification without creating Recipe-specific persistence or identity.
- Estimation is a separate property. A Recipe or ordinary Personal Food may be estimated; manual entry does not automatically mean estimated.
- Support both per-100 nutrition (`g` or `ml`) and per-serving nutrition so quick estimates never require a fabricated weight.
- AI or user assistance may propose an estimated Personal Food, but the person reviews it before save or log.
- Diary snapshots retain estimate status. Later Food edits affect future logs only.
- The diary shows a compact icon beside estimated entries with an accessible label. Do not add a large badge or a day-total warning.
- Combos keep their existing semantics: referenced Foods resolve current figures for a new log, and the resulting Diary Entries are frozen snapshots.
- Capture Drafts remain device-only and separate from Personal Foods.

## Module shape

Deepen the Personal Library module at the existing Personal Food seam. It owns normalized domain types, validation, SQLite persistence, backup payloads, query/filter behavior, and conversion of a selected Personal Food into a Diary snapshot. Callers must not reconstruct provenance, nutrition basis, scaling, or estimate status independently.

Use backward-compatible persisted/wire shapes while exposing normalized required fields inside the module. Existing Personal Foods default to ordinary classification, per-100 basis using their current base unit, and no estimate marker. Old Diary Entries remain valid when the estimate marker is absent.

The existing SQLite adapter and its real SQLite test adapter are the persistence seam; do not add a hypothetical repository port. Keep the existing Convex remote/in-memory test seam for account backup.

## Implementation sequence

1. Add shared Personal Food classification, nutrition-basis, estimate, validation, and snapshot-conversion behavior. Centralize duplicated Personal Food-to-Diary mapping behind the Personal Library interface.
2. Expand Convex Personal Library validation and Diary snapshot validation to accept both legacy and new payloads. Represent the Diary estimate marker additively (for example `estimated?: true`) so historical rows and older operations remain valid.
3. Migrate the Personal Food SQLite schema and backup/restore normalization. Ensure category, estimate status, description, and per-serving basis survive local restart, account backup, restore, conflict resolution, and tombstones.
4. Carry estimate status through local operations, Convex writes/reads, cached projections, copy, move, Combo parts, entry editing, and weekly review.
5. Change the Recipes tab to filter Personal Foods classified as Recipe. Reuse the Personal Food editor and ordinary logging path; remove version, ingredient-snapshot, measured-yield, and Recipe batch concepts from the active UI.
6. Render the compact accessible estimate icon on Diary Entry rows.
7. Add an idempotent account-scoped migration for existing device Recipe rows. Preserve IDs where possible. Convert gram yields to per-100 figures and portion yields to per-serving figures; preserve useful names as description. Queue migrated records through normal Personal Library backup. Mark migration completion per account and retain legacy source rows for a later cleanup release.
8. Reduce the cooking repository to Capture Draft persistence. Move any still-used Combo/One-off helpers to their owning modules, then delete obsolete Recipe types, helpers, screens, copy, and tests.

## Compatibility and rollout

Keep legacy payloads readable throughout. Backend validation must accept old clients before the new mobile payload is emitted. New fields must round-trip through Convex without an older shape silently erasing them; add an explicit payload schema version or downgrade rejection if the current revision protocol cannot guarantee that.

Do not change the accepted offline-first, explicit-backup, conflict, tombstone, or legacy-claim behavior in ADR-0005.

## Verification

Test behavior through the Personal Library and Diary interfaces, replacing obsolete Recipe-layer tests instead of retaining duplicate coverage. Cover at least:

- Personal Food database migration defaults and per-serving estimates.
- Recipe filtering as a Personal Food query.
- Food-to-Diary snapshots preserving estimate status and nutrient states.
- Estimate preservation across create, edit, copy, move, Combo logging, cache reconciliation, and Convex round-trips.
- Account backup/restore, conflict, and tombstone behavior for the new fields.
- Existing Recipe migration is account-isolated, idempotent, and preserves gram/portion meaning.
- The estimate icon is compact and has an accessible label.
- AI/user proposals require review before persistence or logging.

Run `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. The parent checkout previously observed `pnpm check` failing only because nested `.claude/worktrees/*/biome.json` files are discovered as duplicate root configurations; do not weaken Biome configuration or tests to hide that environmental issue. Verify all task-owned files with focused Biome checks if the same unrelated collision exists in the child worktree.

## Completion

The work is complete only when the separate Recipe persistence/logging path is no longer active, existing Recipe data has a safe migration path, all estimate/category/basis fields survive every local and remote path, obsolete tests are replaced, required checks pass or have an evidenced unrelated-environment exception, and the child branch contains incremental commits with a clean worktree.
