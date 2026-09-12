# Remaining nutrition releases — execution contract

User authorized implementation of remaining stages on 2026-09-12, directly in the current checkout, lower-tier subagents where economical, automated verification only. Preserve existing changes. No commits, pushes, production deployment or emulator visual verification.

## Sequence and ownership

1. Parent reviews release-two persistence and fixes demonstrated foundation defects with regression tests. Integrates shared schema, exports, navigation, localization and final checks.
2. Luna: release-three effective-dated goals, approachable editor, calendar. Own goal modules/screens; provide schema table module for parent integration.
3. Terra: release-three account library backup/sync, explicit legacy association, conflicts/tombstones, restore. Own library repository/provider/backend/screen. Parent reviews security boundaries.
4. Luna: release-four recipes/yield, scaled Combos, estimated Log once and durable unfinished drafts. Own cooking modules/screens; use the existing operation service.
5. Luna: release-five constrained text assistance, pasted-label review and factual weekly review. Own assistance/review modules/screens; no AI API or automatic inference.
6. Parent integrates, reviews behavior and runs packages build, mobile/root typechecks and tests, web build, touched-file Biome and diff checks. Failures are fixed or explicitly documented, never hidden by weakening tests.

## Product decisions

- Native Nutrition only, existing warm-dark visual system. New screens are pushed from diary/browser and return to their source; successful logging never navigates back into an unfinished submission.
- Effective goals apply from a local calendar date. Pre-version history is marked reference, not invented history; changing today's goals cannot rewrite yesterday's known goal version.
- Library sync is opt-in. Existing unowned device library requires explicit association with the signed-in account. Authenticated bounded writes, stable IDs, tombstones and explicit conflict resolution preserve user data. Diary snapshots never change on library restore/edit.
- Recipes snapshot ingredients and yield/version; new logs scale unrounded quantities and preserve absent/trace states. Combo scaling affects only that log. Approximate Log once entries remain visibly estimated.
- Notes/photos awaiting review are separate unfinished drafts and contribute no calories. Draft conversion removes the draft only after durable diary acceptance, with retry/crash identity protection.
- Assistance is review-first. Explicit numeric units and food selection are required; ambiguous text remains unresolved. Label text must state per-100 basis and receives editable review. No silent calorie guesses.
- Weekly coverage distinguishes missing days, days with entries, and explicitly marked-complete days. Averages describe recorded intake, not true intake or medical advice.

## Explicit experimental boundaries

The roadmap's optional meal-photo estimation remains deferred pending accuracy/correction-time evaluation. Photo/OCR label recognition is not implied by a pasted-label text parser: report the text-assisted implementation as such. Do not introduce a paid service, credentials, or a fake AI button. Manual comparative speed/device checks remain the user's verification gate; no unmeasured speed or accuracy claims.

## Parent foundation findings

Release-two completion report was checked, not blindly treated as release readiness. Parent found/fixed a zero-filled UUID fallback, missing retry scheduling/foreground reconnect, old-account replay continuation, network-bound success callbacks, client entry IDs incorrectly routed as server IDs, failed rows disappearing from projection, and stale server data overriding newer cached revisions. New service tests cover offline acceptance, UUID uniqueness, retry identity, and account switching. Final integration results are recorded separately.

## Checkpoint files

Task checkpoints live in `remaining/`. Final verification and a precise user checklist will be added there after integration. Native checks are intentionally not performed by the agent in this run.
