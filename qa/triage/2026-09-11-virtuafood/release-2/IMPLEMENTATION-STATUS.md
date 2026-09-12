# Nutrition release 2 implementation status

## Scope and working state

Implementation is being completed directly in the shared checkout. Existing
release-one and unrelated user changes are preserved. No branch, worktree,
commit, push, deployment, or production infrastructure change is planned.

## A — retry-safe server operations

- Status: implemented and focused-verified.
- Changed files: `convex/schema.ts`, `convex/nutritionDiaryModel.ts`,
  `convex/nutritionOperationModel.ts`, `convex/nutritionDiary.ts`,
  `convex/nutritionDiary.operations.test.ts`, `convex/_generated/api.d.ts`,
  `packages/core/src/nutrition/operations.ts`, and
  `packages/core/src/index.ts`.
- Decisions: operation receipts are account-scoped and retained indefinitely;
  day revisions are account/date-scoped and start at zero for legacy days;
  operation payloads use stable canonical JSON; create batches are validated
  completely before the first insert; server-id and client-entry-id targets
  remain a discriminated union at the public boundary.
- Verification: `pnpm build:packages` PASS; supported `pnpm exec convex dev
  --once` PASS against the configured development deployment and refreshed
  generated API types; root `pnpm exec tsc --noEmit` PASS; focused Convex
  suite PASS, 2 files / 16 tests. An initial incorrect Vitest option was
  rejected before tests ran and did not affect product code.
- Blockers: none known.

## B — durable local diary saves

- Status: implemented and focused-verified.
- Changed files: `apps/mobile/src/data/nutrition-local-repository.ts`,
  `apps/mobile/src/data/nutrition-local-repository.test.ts`,
  `apps/mobile/src/data/nutrition-operation-service.tsx`,
  `apps/mobile/src/data/nutrition-day.ts`,
  `apps/mobile/src/data/delete-diary-entry.ts`,
  `apps/mobile/src/test-support/sqlite-test-database.ts`,
  `apps/mobile/src/test-support/render-app.tsx`, and the connected Nutrition
  screens/routes.
- Decisions: SQLite schema version 2 stores immutable operation envelopes,
  retry state, cached day revisions, and account-scoped shortcuts. Replay is
  ordered and serialized; dependent client-entry edits wait behind their
  create; restart recovers `sending`; sign-out changes the active subject
  without deleting another account's dormant data. UI overlays pending
  projections and retains input/editor state on failure.
- Verification: real-file SQLite close/reopen durability, sending recovery,
  offline create/edit/move/delete projection, revision guards, subscription
  deduplication, and account isolation all pass in the focused repository
  suite.

## C — recent foods, favorites, remembered portions

- Status: implemented and focused-verified.
- Changed files: `apps/mobile/src/data/nutrition-shortcuts.ts`,
  `apps/mobile/src/data/nutrition-shortcuts.test.ts`,
  `apps/mobile/src/data/nutrition-operation-service.tsx`,
  `apps/mobile/src/screens/nutrition-food-browser.tsx`, and localization
  messages in `apps/mobile/src/i18n/messages/en.ts` and `nl.ts`.
- Decisions: recents are capped at 50 and favorites are independent; keys are
  stable source identities; serving memory prefers authored semantic identity
  and exact amount, then a same-unit base fallback, never localized-label
  parsing. Shortcut writes are transactionally coupled to local acceptance.
- Verification: focused shortcut and full Nutrition screen suites pass,
  including favorite toggles, serving-memory fallback, empty/error/loading
  states, accessibility labels, and Add & continue behavior.

## D — copy meal, Combo integration and release verification

- Status: implemented and focused-verified.
- Changed files: `apps/mobile/src/data/nutrition-copy.ts`,
  `apps/mobile/src/data/nutrition-copy.test.ts`,
  `apps/mobile/src/screens/nutrition-copy.tsx`,
  `apps/mobile/app/(app)/nutrition-copy.tsx`, the day/Combo/food/editor
  screens and routes, plus their test/support wiring.
- Decisions: source defaults to the previous calendar day relative to the
  selected date and same meal; copying is additive, self-copy is disabled,
  uncached/incomplete offline sources cannot be copied, and one accepted
  batch receives fresh client entry IDs and a fresh shared Combo group.
  Existing Combo logging uses the same durable batch path and preserves
  selection/error semantics.
- Verification: 18 focused Nutrition suites pass, 113 tests total. App
  typecheck, package build, Convex development codegen, Convex operation
  integration tests, and the release-two UI/repository checks pass. The
  complete diff was inspected without resetting pre-existing changes.

## Native checks

Windows has no local iOS simulator. Physical iPhone checks and Android parity
checks will be listed explicitly after automated verification; automated SQLite
reopen tests do not claim to prove an OS force-quit/reopen cycle.

## Automated verification record

- `pnpm build:packages` — PASS.
- `pnpm exec convex dev --once` — PASS against the configured development
  deployment; generated API types refreshed.
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm --dir apps/mobile typecheck` — PASS.
- `pnpm --dir apps/mobile test -- <18 Nutrition suites> --runInBand --silent` —
  PASS, 18 suites / 113 tests.
- `pnpm --dir apps/mobile test --runInBand --silent` — PASS, 31 suites / 190
  tests.
- `pnpm test` — PASS, 32 files / 266 tests.
- `pnpm build` — PASS; production web build and service-worker generation
  completed.
- `npx biome check -- <release-2 files>` — PASS, 32 files.
- `git diff --check` — PASS.
- `pnpm check` — not clean because the repository-wide traversal reaches an
  inaccessible `.pytest_cache` and nested historical `.claude/worktrees`
  Biome configurations; the release-2 file set passes the same check directly.
- Focused Convex operations suite — PASS, 2 files / 16 tests.

## Native checks remaining

Not performed in this Windows session: iOS simulator or physical-iPhone
verification; Android parity; OS-level force-quit/restart and background
reconnect; real airplane-mode transitions; camera permission/barcode flows;
dynamic type, VoiceOver, Switch Control, Reduce Motion, haptic, keyboard and
edge-swipe inspection on device; and low/mid-tier shipped-food search
benchmarking. Automated React Native tests and SQLite file reopen tests do not
stand in for those native checks.
