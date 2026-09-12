# Nutrition release 2 — dependable daily use

## Assignment and baseline

Implement release 2 directly in `D:\Dev\workouts`, using Luna (`gpt-5.6-luna`) at high effort. The user explicitly requested no worktree. Release 1 is complete and currently includes uncommitted changes: preserve and build on them. Do not create branches/worktrees, reset files, commit, push, deploy, or delegate to another agent. Product implementation is authorized; production infrastructure changes are not.

Read root AGENTS.md, CLAUDE.md and their referenced global instructions first. Read instructions applicable to every modified directory. Use pnpm and apply_patch. Consult the Appelent catalog before inventing reusable cross-app infrastructure, and the Convex expert skill before changing convex code. Inspect actual scripts and code rather than assuming the pointers below remain exact.

This document is the release contract. PROPOSAL.md supplies rationale; HANDOFF.md/TRIAGE.md supply historical competitor evidence, not implementation instructions. No new full-video analysis is required. The earlier review sampled the opening approximately two minutes; offline guarantees below are our product requirements, not claims demonstrated by that recording.

## Outcome

Returning users can log their usual foods quickly, copy an earlier meal, and reuse Combos without worrying whether a weak connection lost their entries. Four sequential tasks share one persistence path:

1. [A — retry-safe server operations](release-2/A-OPERATIONS.md).
2. [B — durable local saves and reconciliation](release-2/B-LOCAL-SAVES.md).
3. [C — recent foods, favorites, remembered portions](release-2/C-SHORTCUTS.md).
4. [D — meal copying, Combo integration and release verification](release-2/D-COPY-COMBOS.md).

Read each brief fully when starting it. Implement and run its targeted checks before proceeding. Maintain `release-2/IMPLEMENTATION-STATUS.md` after each task with changed files, decisions, commands/results, blockers, and remaining checks. Complete all four, not just task A. Keep public interfaces small: one nutrition operation service, one local repository, and pure projection helpers; screens must not implement their own retry queues.

## Scope boundaries

Included: durable diary create/update/delete/batch operations; account-scoped local cache/outbox; Recent/Favorites; last-used portions; copy meal; Combos in Add food; selected-date correctness. Keep existing standalone Combo access.

Deferred: personal-food/Combo cloud backup or synchronization, recipes/cooked yields, scaled Combos, AI/photo logging, goal editor, effective-dated goals, calendar redesign, one-off-food creation, new datasets/providers, training-budget changes. Existing personal foods/Combos remain device-local under ADR 0005; do not silently migrate legacy ownership. New account-scoped data does not make the existing device-wide library account-private.

## Shared invariants

- Preserve release-one summary, portion footer, visible meal selector, Add & continue, snapshot provenance and all eight nutrient states. Missing/trace nutrition is never zero. Use unrounded existing core arithmetic; round at display boundaries.
- A diary entry is a historical snapshot. Logging a food or Combo resolves current source data; copying an old meal copies recorded snapshots unchanged.
- Every intent has one durable operation ID reused across retries. Two intentional taps after completion are two intents, not duplicates. A submitted payload is immutable.
- Local SQLite commit is the acceptance boundary. Only after it succeeds may the UI clear input or say “Saved on this device.” Cloud acknowledgement is a separate state. Failed local writes retain input and show an error.
- Cache/outbox/shortcuts are keyed by authenticated subject, never email. Suspend processing on sign-out and bind late callbacks to the originating subject. Account B must neither see A's diary cache/shortcuts nor upload A's queued entries. Returning to A resumes A's queue. Do not persist tokens.
- Date and meal travel explicitly from the selected diary context through every entry point. Never substitute today's date when the user selected another day.
- Keep warm dark theme, lime primary actions, native navigation, existing spacing/type, and English/Dutch parity. Design empty/loading/error/success states. Accessible labels and 44-point minimum targets are required; retain larger platform-specific defaults.

## Known code entry points

`convex/nutritionDiary.ts`, `convex/nutritionDiaryModel.ts`, `convex/schema.ts`; mobile `src/data/nutrition-day.ts`, `personal-food-repository.ts`; `src/screens/nutrition-food-browser.tsx`, `nutrition-day.tsx`, `nutrition-entry-editor.tsx`, `nutrition-combos.tsx`; `src/convex/provider.tsx`; `app/(app)/_layout.tsx`. Locate deletion helper via rg. Existing SQLite library migrates through version 3; use a separate database for the new account-scoped state so independent migrators do not contend over its user_version.

Release-one header Add currently passes `todayIsoDate()` even while the diary displays another date. Fix this during integration with a small selected-day context or screen-owned navigation options; inspect current patterns first.

## Verification and honesty

Use package scripts on disk. Expected integration checks are core build, mobile typecheck and full Jest suite, root typecheck, tests, build, touched-file Biome, and git diff --check. Try root `pnpm check`; release one reported unrelated `.pytest_cache` access and nested `.claude/worktrees` configuration failures. Record fresh results and distinguish baseline failures from regressions. Never weaken tests or broad-ignore files to obtain green checks.

Native validation: iPhone airplane-mode save, force-quit/reopen, reconnect, repeated retry, copied meal, keyboard footer, large text, Dutch, VoiceOver, Reduce Motion; Android back/keyboard and offline restart parity. Automated database-reopen tests supplement but do not prove an actual OS process-kill test. Mark native checks outstanding if unavailable on Windows. Do not claim unperformed checks passed.

Final report: completed tasks; changed paths; test evidence; unresolved/native-only checks; any deviations. Completion requires user-facing shortcuts plus the tested durable data path, not an unconnected queue implementation.
